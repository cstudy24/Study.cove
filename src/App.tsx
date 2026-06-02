import React, { useState, useEffect, useRef } from "react";
import {
  BookOpen,
  Calendar,
  Megaphone,
  Coins,
  Users,
  Bot,
  Send,
  Lock,
  Unlock,
  LogOut,
  CheckCircle,
  AlertCircle,
  Info,
  X,
  Plus,
  Trash2,
  Download,
  ExternalLink,
  FileText,
  Upload,
  HelpCircle,
  ChevronRight,
  User,
  Settings,
  ClipboardList,
  Search,
  BookMarked,
  Bell,
  BellRing
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  db,
  auth,
  storage,
  isFirebaseInitialized,
  OperationType,
  handleFirestoreError
} from "./lib/firebase";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  addDoc,
  deleteDoc,
  doc,
  setDoc,
  serverTimestamp
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider
} from "firebase/auth";

// Interfaces sesuai data invariant blueprint
interface Announcement {
  id: string;
  title: string;
  content: string;
  writer: string;
  createdAt: any;
}

interface Schedule {
  id: string;
  day: string;
  subject: string;
  time: string;
  lecturer: string;
  room: string;
}

interface Treasury {
  id: string;
  studentName: string;
  nim: string;
  amount: number;
  status: "Lunas" | "Belum Lunas";
  updatedAt: any;
}

interface LibraryItem {
  id: string;
  title: string;
  author: string;
  category: string;
  description: string;
  downloadUrl: string;
}

interface StudyGroup {
  id: string;
  name: string;
  description: string;
  members: string; // List of members separated by comma
  status?: "Selesai" | "Belum Selesai";
}

interface AssignmentSubmission {
  id: string;
  title: string;
  subject: string;
  studentName: string;
  nim: string;
  fileUrl: string;
  fileName: string;
  lecturer: string;
  createdAt: any;
  dueDate?: string;
  uidCheck?: string;
}

interface ToastMessage {
  id: string;
  text: string;
  type: "success" | "error" | "info" | "warning";
}

interface ChatMessage {
  id: string;
  role: "user" | "model";
  text: string;
}

export default function App() {
  // Global States
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const [authForm, setAuthForm] = useState({ email: "", password: "", name: "" });

  // Custom Firebase Configuration Modal & Setup
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [customConfig, setCustomConfig] = useState({
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: ""
  });

  // Database States
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [treasury, setTreasury] = useState<Treasury[]>([]);
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [groups, setGroups] = useState<StudyGroup[]>([]);
  const [assignments, setAssignments] = useState<AssignmentSubmission[]>([]);

  // Navigation & Menu Status
  const [activeTab, setActiveTab] = useState<"dashboard" | "treasury" | "assignments" | "groups" | "library">("dashboard");
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [libraryFilter, setLibraryFilter] = useState("Semua");
  const [scheduleDayFilter, setScheduleDayFilter] = useState("Semua");

  // Assignment submission forms
  const [submittingAssignment, setSubmittingAssignment] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [lastUploadedUrl, setLastUploadedUrl] = useState<string | null>(null);
  const [lastUploadedLecturer, setLastUploadedLecturer] = useState("");
  const [lastUploadedSubject, setLastUploadedSubject] = useState("");
  const [lastUploadedName, setLastUploadedName] = useState("");
  const [lastUploadedNIM, setLastUploadedNIM] = useState("");
  const [assignmentForm, setAssignmentForm] = useState({
    assignmentType: "individu" as "individu" | "kelompok",
    taskType: "Jurnal" as "Jurnal" | "Essay" | "Makalah" | "PPT" | "Unjuk Kerja",
    groupNumber: "",
    groupMembers: "",
    presentationDate: "",
    title: "",
    subject: "Kepemimpinan Pendidikan Islam",
    lecturer: "Prof. Dr. KH. Muhaimin, M.A.",
    studentName: "",
    nim: "",
    dueDate: "",
    file: null as File | null
  });

  // Admin CRUD states
  const [newAnnouncement, setNewAnnouncement] = useState({ title: "", content: "", writer: "" });
  const [newSchedule, setNewSchedule] = useState({ day: "Senin", subject: "", time: "", lecturer: "", room: "" });
  const [newTreasury, setNewTreasury] = useState({ studentName: "", nim: "", amount: 20000, status: "Lunas" as "Lunas" | "Belum Lunas" });
  const [newLibrary, setNewLibrary] = useState({ title: "", author: "", category: "Administrasi Pendidikan", description: "", downloadUrl: "" });
  const [newGroup, setNewGroup] = useState({ name: "", description: "", members: "", status: "Belum Selesai" as "Selesai" | "Belum Selesai" });

  // Floating Gemini Chat states
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessageInput, setChatMessageInput] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    { id: "init-message", role: "model", text: "Assalamu'alaikum! Saya AI Asisten Akademik S1 MPAI. Silakan tanyakan materi kuliah, kepemimpinan Islam, administrasi, sosiologi pendidikan, kurikulum, atau bimbingan tugas." }
  ]);
  const [isGeneratingChat, setIsGeneratingChat] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Custom Toast State
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Onboarding Tour active/inactive
  const [showTour, setShowTour] = useState(false);
  const [tourStep, setTourStep] = useState(0);

  // Notification States
  const [readAnnouncementIds, setReadAnnouncementIds] = useState<string[]>(() => {
    const saved = localStorage.getItem("study_cove_read_ann_ids");
    return saved ? JSON.parse(saved) : [];
  });
  const [showBellDropdown, setShowBellDropdown] = useState(false);
  const announcementsRef = useRef<Announcement[]>([]);

  useEffect(() => {
    announcementsRef.current = announcements;
  }, [announcements]);

  // Toast Dispatcher Utility
  const dispatchToast = (text: string, type: "success" | "error" | "info" | "warning" = "success") => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  // Check auth and user snapshot
  useEffect(() => {
    // If Firebase is initialized, register state trigger
    if (isFirebaseInitialized && auth) {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) {
          setCurrentUser(user);
          // Check if user is first-timer to start onboarding tour
          const hasVisited = localStorage.getItem(`study_cove_tour_${user.uid}`);
          if (!hasVisited) {
            setShowTour(true);
            localStorage.setItem(`study_cove_tour_${user.uid}`, "true");
          }
        } else {
          setCurrentUser(null);
        }
        setAuthLoading(false);
      });
      return unsubscribe;
    } else {
      // Offline/Default simulation user state
      const simulatedUser = localStorage.getItem("study_cove_simulated_user");
      if (simulatedUser) {
        setCurrentUser(JSON.parse(simulatedUser));
      }
      setAuthLoading(false);
    }
  }, []);

  // Firebase Realtime Synchronization (onSnapshot)
  useEffect(() => {
    if (!currentUser) return;

    if (isFirebaseInitialized && db) {
      // 1. Announcements snap
      const qAnnouncements = query(collection(db, "announcements"), orderBy("createdAt", "desc"));
      let isInitial = true;
      const unsubAnn = onSnapshot(qAnnouncements, (snapshot) => {
        const list: Announcement[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as Announcement);
        });
        
        if (!isInitial) {
          const prevIds = announcementsRef.current.map((a) => a.id);
          const newlyAdded = list.filter((item) => !prevIds.includes(item.id));
          if (newlyAdded.length > 0) {
            newlyAdded.forEach((newItem) => {
              dispatchToast(`🔔 Pengumuman Baru Terbit! "${newItem.title}" oleh ${newItem.writer}`, "info");
            });
          }
        }
        isInitial = false;
        setAnnouncements(list);
      }, (error) => handleFirestoreError(error, OperationType.LIST, "announcements"));

      // 2. Schedules snap
      const qSchedules = query(collection(db, "schedules"));
      const unsubSched = onSnapshot(qSchedules, (snapshot) => {
        const list: Schedule[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as Schedule);
        });
        setSchedules(list);
      }, (error) => handleFirestoreError(error, OperationType.LIST, "schedules"));

      // 3. Treasury snap
      const qTreasury = query(collection(db, "treasury"), orderBy("updatedAt", "desc"));
      const unsubTreas = onSnapshot(qTreasury, (snapshot) => {
        const list: Treasury[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as Treasury);
        });
        setTreasury(list);
      }, (error) => handleFirestoreError(error, OperationType.LIST, "treasury"));

      // 4. Library snap
      const qLib = query(collection(db, "library"));
      const unsubLib = onSnapshot(qLib, (snapshot) => {
        const list: LibraryItem[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as LibraryItem);
        });
        setLibrary(list);
      }, (error) => handleFirestoreError(error, OperationType.LIST, "library"));

      // 5. Study Groups snap
      const qGroups = query(collection(db, "groups"));
      const unsubGroups = onSnapshot(qGroups, (snapshot) => {
        const list: StudyGroup[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as StudyGroup);
        });
        setGroups(list);
      }, (error) => handleFirestoreError(error, OperationType.LIST, "groups"));

      // 6. Assignments snap
      const qAssignments = query(collection(db, "assignments"), orderBy("createdAt", "desc"));
      const unsubAssign = onSnapshot(qAssignments, (snapshot) => {
        const list: AssignmentSubmission[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as AssignmentSubmission);
        });
        setAssignments(list);
      }, (error) => handleFirestoreError(error, OperationType.LIST, "assignments"));

      return () => {
        unsubAnn();
        unsubSched();
        unsubTreas();
        unsubLib();
        unsubGroups();
        unsubAssign();
      };
    } else {
      // LocalStorage Simulated Snapshots
      const syncLocal = () => {
        // Load default files
        const localAnn = localStorage.getItem("study_cove_announcements");
        if (localAnn) {
          const list = JSON.parse(localAnn);
          const prevIds = announcementsRef.current.map((a) => a.id);
          const newlyAdded = list.filter((item: any) => !prevIds.includes(item.id));
          if (newlyAdded.length > 0 && prevIds.length > 0) {
            newlyAdded.forEach((newItem: any) => {
              dispatchToast(`🔔 Pengumuman Baru Terbit! "${newItem.title}" oleh ${newItem.writer}`, "info");
            });
          }
          setAnnouncements(list);
        }
        else {
          const defAnn: Announcement[] = [
            {
              id: "ann-1",
              title: "Pendaftaran Ujian Tugas Akhir (Proposal Skripsi) Semester Genap",
              content: "Seluruh mahasiswa S1 MPAI semester akhir harap mengumpulkan berkas pendaftaran proposal skripsi dalam format PDF ke ketua jurusan paling lambat 20 Juni 2026.",
              writer: "Kaprodi S1 MPAI",
              createdAt: new Date(2026, 5, 1).toISOString()
            },
            {
              id: "ann-2",
              title: "Kuliah Tamu: Transformasi Administrasi Lembaga Pendidikan Islam Era AI",
              content: "Wajib dihadiri bagi angkatan 2024 & 2025 dengan pembicara dari Universitas Islam Internasional.",
              writer: "BEM MPAI",
              createdAt: new Date(2026, 4, 15).toISOString()
            }
          ];
          setAnnouncements(defAnn);
          localStorage.setItem("study_cove_announcements", JSON.stringify(defAnn));
        }

        const localSched = localStorage.getItem("study_cove_schedules");
        if (localSched) setSchedules(JSON.parse(localSched));
        else {
          const defSched: Schedule[] = [
            { id: "sch-1", day: "Senin", subject: "Kepemimpinan Pendidikan Islam", time: "08:00 - 10:30", lecturer: "Prof. Dr. KH. Muhaimin, M.A.", room: "R. Sidang 2" },
            { id: "sch-2", day: "Selasa", subject: "Administrasi Pendidikan Kontemporer", time: "10:45 - 13:15", lecturer: "Dr. Siti Aminah, M.Pd.", room: "Lab Komputer" },
            { id: "sch-3", day: "Rabu", subject: "Metodologi Penelitian Pendidikan", time: "08:00 - 10:30", lecturer: "KH. Ahmad Ridwan, Ph.D.", room: "R. Kelas B" },
            { id: "sch-4", day: "Kamis", subject: "Evaluasi Kurikulum PAI", time: "13:30 - 16:00", lecturer: "Dra. Lailatul Qadriah, M.Si.", room: "R. Kuliah 4" },
            { id: "sch-5", day: "Jumat", subject: "Perencanaan & Manajemen Strategis", time: "09:00 - 11:30", lecturer: "Dr. Hasan Basri, M.Ag.", room: "R. Utama" }
          ];
          setSchedules(defSched);
          localStorage.setItem("study_cove_schedules", JSON.stringify(defSched));
        }

        const localTreas = localStorage.getItem("study_cove_treasury");
        if (localTreas) setTreasury(JSON.parse(localTreas));
        else {
          const defTreas: Treasury[] = [
            { id: "tr-1", studentName: "Ahmad Mujahidin", nim: "202621001", amount: 20000, status: "Lunas", updatedAt: new Date(2026, 5, 1).toISOString() },
            { id: "tr-2", studentName: "Aisyah Humaira", nim: "202621002", amount: 20000, status: "Lunas", updatedAt: new Date(2026, 5, 1).toISOString() },
            { id: "tr-3", studentName: "Rizki Ramadhan", nim: "202621003", amount: 20000, status: "Belum Lunas", updatedAt: new Date(2026, 5, 2).toISOString() }
          ];
          setTreasury(defTreas);
          localStorage.setItem("study_cove_treasury", JSON.stringify(defTreas));
        }

        const localLib = localStorage.getItem("study_cove_library");
        if (localLib) setLibrary(JSON.parse(localLib));
        else {
          const defLib: LibraryItem[] = [
            { id: "lib-1", title: "Metodologi Penelitian Pendidikan PAI Tematis", author: "KH. Ahmad Ridwan, Ph.D.", category: "Metodologi Penelitian", description: "Bahan panduan penelitian aplikatif untuk perumusan hipotesis instansi pendidikan agama islam.", downloadUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf" },
            { id: "lib-2", title: "Manajemen Sekolah Unggul Berbasis Nilai Islam", author: "Dr. Siti Aminah, M.Pd.", category: "Administrasi Pendidikan", description: "Buku acuan tata kelola administrasi modern dan kearsipan digital madrasah.", downloadUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf" },
            { id: "lib-3", title: "Rekonstruksi Kurikulum Modifikasi Kurikulum Merdeka PAI", author: "Dra. Lailatul Qadriah, M.Si.", category: "Evaluasi Kurikulum", description: "Studi kasus evaluasi kurikulum tingkat tinggi di S1 MPAI nusantara.", downloadUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf" }
          ];
          setLibrary(defLib);
          localStorage.setItem("study_cove_library", JSON.stringify(defLib));
        }

        const localGroups = localStorage.getItem("study_cove_groups");
        if (localGroups) setGroups(JSON.parse(localGroups));
        else {
          const defGroups: StudyGroup[] = [
            { id: "gp-1", name: "Kelompok A - Analisis Kebijakan S1 MPAI", description: "Fokus membahas kurikulum merdeka dan dampaknya bagi akreditasi madrasah.", members: "Ahmad Mujahidin, Rizki Ramadhan, Laili Ismiati", status: "Belum Selesai" },
            { id: "gp-2", name: "Kelompok B - Manajemen Sistem Informasi", description: "Fokus merancang arsitektur administrasi sekolah digital tingkat prodi.", members: "Aisyah Humaira, Bagus Pratama, Farida Zahra", status: "Selesai" }
          ];
          setGroups(defGroups);
          localStorage.setItem("study_cove_groups", JSON.stringify(defGroups));
        }

        const localAssign = localStorage.getItem("study_cove_assignments");
        if (localAssign) setAssignments(JSON.parse(localAssign));
        else {
          const defAssign: AssignmentSubmission[] = [
            { id: "as-1", title: "Analisis Struktur Kepemimpinan Pondok Pesantren Terpadu", subject: "Kepemimpinan Pendidikan Islam", studentName: "Ahmad Mujahidin", nim: "202621001", fileUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf", fileName: "Tugas1_Kepemimpinan_Ahmad.pdf", lecturer: "Prof. Dr. KH. Muhaimin, M.A.", createdAt: new Date(2026, 5, 1, 10, 0).toISOString(), dueDate: "2026-06-15" }
          ];
          setAssignments(defAssign);
          localStorage.setItem("study_cove_assignments", JSON.stringify(defAssign));
        }
      };

      syncLocal();
      window.addEventListener("storage", syncLocal);
      return () => window.removeEventListener("storage", syncLocal);
    }
  }, [currentUser]);

  // Scroll chat AI Assistant to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, isChatOpen]);

  // Firebase/Email Register & Login handler
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authForm.email || !authForm.password) {
      dispatchToast("Harap isi Email dan Password!", "warning");
      return;
    }
    
    if (isFirebaseInitialized && auth) {
      try {
        if (isRegistering) {
          await createUserWithEmailAndPassword(auth, authForm.email, authForm.password);
          dispatchToast("Pendaftaran mahasiswa S1 MPAI sukses!", "success");
        } else {
          await signInWithEmailAndPassword(auth, authForm.email, authForm.password);
          dispatchToast("Selamat datang di Study Cove!", "success");
        }
      } catch (error: any) {
        dispatchToast(error.message || "Gagal melakukan otentikasi.", "error");
      }
    } else {
      // Offline Simulation login
      const name = isRegistering ? (authForm.name || authForm.email.split("@")[0]) : authForm.email.split("@")[0];
      const mockUser = {
        uid: "simulated-" + Date.now(),
        email: authForm.email,
        displayName: name,
        emailVerified: true
      };
      setCurrentUser(mockUser);
      localStorage.setItem("study_cove_simulated_user", JSON.stringify(mockUser));
      dispatchToast(`[MODE DEMO] Berhasil masuk sebagai: ${name}`, "success");
      
      // Automatic onboarding trigger for demo mode
      const hasVisited = localStorage.getItem(`study_cove_tour_${mockUser.uid}`);
      if (!hasVisited) {
        setShowTour(true);
        localStorage.setItem(`study_cove_tour_${mockUser.uid}`, "true");
      }
    }
  };

  const handleGoogleLogin = async () => {
    if (isFirebaseInitialized && auth) {
      try {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
        dispatchToast("Berhasil masuk melalui Google!", "success");
      } catch (error: any) {
        dispatchToast(error.message || "Gagal masuk menggunakan Google", "error");
      }
    } else {
      const mockUser = {
        uid: "google-simulated-" + Date.now(),
        email: "mahasiswa.mpai@gmail.com",
        displayName: "S1 MPAI Google Student",
        photoURL: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=120"
      };
      setCurrentUser(mockUser);
      localStorage.setItem("study_cove_simulated_user", JSON.stringify(mockUser));
      dispatchToast("[MODE DEMO] Berhasil masuk dengan Google simulasi!", "success");
    }
  };

  const handleLogout = async () => {
    if (isFirebaseInitialized && auth) {
      await signOut(auth);
    } else {
      localStorage.removeItem("study_cove_simulated_user");
      setCurrentUser(null);
    }
    setIsAdminMode(false);
    dispatchToast("Anda telah keluar dari aplikasi.", "info");
  };

  // Manual Trigger Tour
  const triggerManualTour = () => {
    setTourStep(0);
    setShowTour(true);
  };

  // Onboarding Tour steps configuration
  const tourSteps = [
    {
      title: "Selamat datang di Study Cove! 👋",
      content: "Portal khusus mahasiswa S1 Manajemen Pendidikan Agama Islam (MPAI). Mari kami pandu fitur utamanya.",
      target: "portal-header"
    },
    {
      title: "Menu Utama Navigasi 🔍",
      content: "Gunakan menu navigasi atas untuk berpindah modul: Beranda, Kas Kelas, Pengumpulan Tugas, Data Kelompok, dan Perpustakaan Akademik.",
      target: "navigation-bar"
    },
    {
      title: "Asisten AI Akademik Gemini 🤖",
      content: "Punya pertanyaan seputar kurikulum, kepemimpinan Islam, atau administrasi? Klik tombol asisten mengambang di pojok kanan bawah ini!",
      target: "floating-gemini-trigger"
    },
    {
      title: "Transparansi Riwayat Tugas 📂",
      content: "Seluruh mahasiswa S1 MPAI dapat saling melihat dan mengunduh berkas tugas demi menjamin objektivitas akademik prodi yang transparan.",
      target: "assignments-module"
    },
    {
      title: "Lapor WA Dosen Otomatis 💬",
      content: "Setiap selesai mengumpulkan tugas, sistem akan menyediakan tombol instan untuk mengirim bukti log tugas langsung ke WhatsApp Dosen pengampu.",
      target: "whatsapp-onboarding"
    }
  ];

  const handleNextTour = () => {
    if (tourStep < tourSteps.length - 1) {
      setTourStep(tourStep + 1);
    } else {
      setShowTour(false);
      dispatchToast("Tour selesai! Selamat menggunakan Study Cove.", "success");
    }
  };

  // Admin Verification Panel
  const handleAdminAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassword === "MPAI2026") {
      setIsAdminMode(true);
      setShowAdminLogin(false);
      setAdminPassword("");
      dispatchToast("Akses Admin Unlocked! Mode CRUD diaktifkan.", "success");
    } else {
      dispatchToast("Sandi admin tidak cocok!", "error");
    }
  };

  // Dynamic Save to LocalStorage / Firestore Action Hub
  const performAdd = async (collectionName: string, payload: any) => {
    if (isFirebaseInitialized && db) {
      try {
        await addDoc(collection(db, collectionName), {
          ...payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        dispatchToast(`Data berhasil ditambahkan ke Firebase!`, "success");
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, collectionName);
      }
    } else {
      // Offline save hook
      const localKey = `study_cove_${collectionName}`;
      const existing = localStorage.getItem(localKey);
      const list = existing ? JSON.parse(existing) : [];
      const newRecord = {
        id: `sim-${Date.now()}`,
        ...payload,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      const updated = [newRecord, ...list];
      localStorage.setItem(localKey, JSON.stringify(updated));
      // Trigger reactivity manually
      window.dispatchEvent(new Event("storage"));
      dispatchToast(`[MOCK DEMO] Data berhasil disimpan secara lokal!`, "success");
    }
  };

  const performDelete = async (collectionName: string, id: string) => {
    if (isFirebaseInitialized && db) {
      try {
        await deleteDoc(doc(db, collectionName, id));
        dispatchToast("Data berhasil dihapus dari Firebase!", "success");
      } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, `${collectionName}/${id}`);
      }
    } else {
      // Offline delete hook
      const localKey = `study_cove_${collectionName}`;
      const existing = localStorage.getItem(localKey);
      if (existing) {
        const list = JSON.parse(existing);
        const updated = list.filter((item: any) => item.id !== id);
        localStorage.setItem(localKey, JSON.stringify(updated));
        window.dispatchEvent(new Event("storage"));
        dispatchToast("[MOCK DEMO] Data dihapus secara lokal!", "warning");
      }
    }
  };

  // 1. ADD CRUD Announcement
  const handleAddAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnouncement.title || !newAnnouncement.content || !newAnnouncement.writer) {
      dispatchToast("Harap isi semua kolom pengumuman!", "warning");
      return;
    }
    performAdd("announcements", newAnnouncement);
    setNewAnnouncement({ title: "", content: "", writer: "" });
  };

  // 2. ADD CRUD Schedule
  const handleAddSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSchedule.subject || !newSchedule.time || !newSchedule.lecturer || !newSchedule.room) {
      dispatchToast("Harap isi seluruh isian jadwal!", "warning");
      return;
    }
    performAdd("schedules", newSchedule);
    setNewSchedule({ day: "Senin", subject: "", time: "", lecturer: "", room: "" });
  };

  // 3. ADD CRUD Treasury
  const handleAddTreasury = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTreasury.studentName || !newTreasury.nim) {
      dispatchToast("Isi nama mahasiswa dan NIM!", "warning");
      return;
    }
    performAdd("treasury", newTreasury);
    setNewTreasury({ studentName: "", nim: "", amount: 20000, status: "Lunas" });
  };

  // 4. ADD CRUD Library item
  const handleAddLibrary = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLibrary.title || !newLibrary.author || !newLibrary.downloadUrl) {
      dispatchToast("Isi judul buku, dosen/penulis, dan link dokumen PDF!", "warning");
      return;
    }
    performAdd("library", newLibrary);
    setNewLibrary({ title: "", author: "", category: "Administrasi Pendidikan", description: "", downloadUrl: "" });
  };

  // 5. ADD CRUD Academic Group
  const handleAddGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroup.name || !newGroup.members) {
      dispatchToast("Isi nama kelompok belajar serta anggotanya!", "warning");
      return;
    }
    performAdd("groups", newGroup);
    setNewGroup({ name: "", description: "", members: "", status: "Belum Selesai" });
  };

  // File Upload Handlers (Firebase Storage with Demo Fallback Mode)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAssignmentForm({ ...assignmentForm, file: e.target.files[0] });
      dispatchToast(`File '${e.target.files[0].name}' terpilih.`, "info");
    }
  };

  const handleAssignmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { assignmentType, taskType, groupNumber, groupMembers, presentationDate, subject, file, lecturer, dueDate } = assignmentForm;

    if (!file) {
      dispatchToast("Harap lampirkan file tugas Anda!", "warning");
      return;
    }

    let calculatedStudentName = "";
    let calculatedNim = "";
    let calculatedTitle = "";
    let calculatedDueDate = "";

    if (assignmentType === "kelompok") {
      if (!groupNumber || !groupMembers) {
        dispatchToast("Data pengumpulan belum lengkap! Silakan isi Kelompok dan Anggota Kelompok.", "warning");
        return;
      }
      calculatedStudentName = `Kelompok ${groupNumber}`;
      calculatedNim = `Anggota: ${groupMembers}`;
      calculatedTitle = `Tugas Kelompok ${groupNumber}: ${taskType}`;
      calculatedDueDate = presentationDate || "";
    } else {
      if (!dueDate) {
        dispatchToast("Data pengumpulan belum lengkap! Silakan isi Tanggal Tenggat Waktu (Deadline).", "warning");
        return;
      }
      calculatedStudentName = currentUser?.displayName || currentUser?.email?.split("@")[0] || "Mahasiswa S1 MPAI";
      
      const savedNim = localStorage.getItem("study_cove_my_nim");
      if (savedNim) {
        calculatedNim = savedNim;
      } else {
        const match = treasury.find(t => t.studentName.toLowerCase() === calculatedStudentName.toLowerCase());
        if (match) {
          calculatedNim = match.nim;
        } else {
          calculatedNim = "202621" + Math.floor(100 + Math.random() * 900);
          localStorage.setItem("study_cove_my_nim", calculatedNim);
        }
      }
      calculatedTitle = `Tugas Individu: ${taskType}`;
      calculatedDueDate = dueDate;
    }

    setSubmittingAssignment(true);
    setUploadProgress(15);

    let finalFileUrl = "";
    const mockfileName = file.name;

    if (isFirebaseInitialized && storage) {
      try {
        setUploadProgress(40);
        const fileRef = ref(storage, `assignments/${currentUser?.uid || "general"}/${Date.now()}_${file.name}`);
        const snapshot = await uploadBytes(fileRef, file);
        setUploadProgress(80);
        finalFileUrl = await getDownloadURL(snapshot.ref);
        setUploadProgress(100);
      } catch (err) {
        console.error("Gagal mengunggah file ke Storage, beralih ke Mode Simulator Cadangan", err);
        finalFileUrl = "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";
      }
    } else {
      // Simulation mode
      setTimeout(() => {
        setUploadProgress(60);
      }, 500);
      setTimeout(() => {
        setUploadProgress(100);
      }, 1000);
      
      // Simulating a Blob URL in memory or placeholder
      finalFileUrl = "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";
    }

    // Prepare assignment model
    setTimeout(async () => {
      const payload = {
        assignmentType,
        taskType,
        groupNumber: assignmentType === "kelompok" ? groupNumber : "",
        groupMembers: assignmentType === "kelompok" ? groupMembers : "",
        presentationDate: assignmentType === "kelompok" ? presentationDate : "",
        title: calculatedTitle,
        subject,
        studentName: calculatedStudentName,
        nim: calculatedNim,
        dueDate: calculatedDueDate,
        fileUrl: finalFileUrl,
        fileName: mockfileName,
        lecturer,
        uidCheck: currentUser?.uid || "guest"
      };

      await performAdd("assignments", payload);

      // Trigger "WhatsApp Dosen" Button states
      setLastUploadedUrl(finalFileUrl);
      setLastUploadedLecturer(lecturer);
      setLastUploadedSubject(subject);
      setLastUploadedName(calculatedStudentName);
      setLastUploadedNIM(calculatedNim);

      // Reset Form fields
      setAssignmentForm({
        assignmentType,
        taskType: "Jurnal",
        groupNumber: "",
        groupMembers: "",
        presentationDate: "",
        title: "",
        subject: "Kepemimpinan Pendidikan Islam",
        lecturer: "Prof. Dr. KH. Muhaimin, M.A.",
        studentName: "",
        nim: "",
        dueDate: "",
        file: null
      });

      setSubmittingAssignment(false);
      setUploadProgress(0);
      dispatchToast(`Tugas ${assignmentType === "kelompok" ? "Kelompok" : "Individu"} berhasil terdaftar secara real-time! Klik tombol lapor dosen.`, "success");
    }, 1200);
  };

  // WhatsApp Message Formatter API Redirection
  const triggerWhatsAppRedirect = () => {
    if (!lastUploadedUrl) {
      dispatchToast("Tidak ada riwayat berkas tugas terbaru untuk dilaporkan!", "warning");
      return;
    }

    const message = `Yth. Dosen ${lastUploadedLecturer}, saya ${lastUploadedName}/NIM ${lastUploadedNIM} telah mengumpulkan tugas ${lastUploadedSubject} dengan judul "${assignmentForm.title || 'tugas akademik S1 MPAI'}". Berikut link tugas saya: ${lastUploadedUrl}`;
    const uriPath = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
    
    // Non-blocking redirect
    window.open(uriPath, "_blank");
    dispatchToast("Membuka WhatsApp API...", "success");
  };

  // Export CSV Academic transparency handler
  const handleDownloadCSV = () => {
    if (assignments.length === 0) {
      dispatchToast("Daftar tugas kosong. Tidak ada data untuk diunduh.", "warning");
      return;
    }

    // Constructing CSV String
    let csvContent = "\uFEFF"; // BOM header for Excel encoding Indonesian characters
    csvContent += "No;Mata Kuliah;Judul Tugas;Mahasiswa;NIM;Dosen Pengampu;Tenggat Waktu;Tanggal Pengumpulan;Link Tugas Dari Firebase\n";

    assignments.forEach((as, index) => {
      const dates = new Date(as.createdAt?.seconds ? as.createdAt.seconds * 1000 : as.createdAt).toLocaleString("id-ID");
      const dueStr = as.dueDate ? as.dueDate : "-";
      csvContent += `${index + 1};"${as.subject}";"${as.title}";"${as.studentName}";"${as.nim}";"${as.lecturer}";"${dueStr}";"${dates}";"${as.fileUrl}"\n`;
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `StudyCove_S1MPAI_LaporanTransparansiTugas_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    dispatchToast("Laporan transparansi terunduh dalam format CSV!", "success");
  };

  // Send request to Gemini academic chatbot server api proxy
  const handleSendGeminiChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessageInput.trim()) return;

    const userText = chatMessageInput;
    setChatMessageInput("");
    
    // Add user question to history
    const userMsg: ChatMessage = { id: `chat-${Date.now()}-user`, role: "user", text: userText };
    setChatHistory((prev) => [...prev, userMsg]);
    setIsGeneratingChat(true);

    try {
      // Strip system instruction placeholder history
      const formattedHistory = chatHistory
        .filter((h) => h.id !== "init-message")
        .map((h) => ({ role: h.role, text: h.text }));

      const res = await fetch("/api/gemini/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userText,
          history: formattedHistory
        })
      });

      const data = await res.json();
      if (res.ok) {
        const modelMsg: ChatMessage = { id: `chat-${Date.now()}-ai`, role: "model", text: data.text || "Pesan kosong diterima dari server." };
        setChatHistory((prev) => [...prev, modelMsg]);
      } else {
        throw new Error(data.error || "Gagal mendapatkan respon AI.");
      }
    } catch (err: any) {
      dispatchToast("Gagal melakukan percakapan AI: " + err.message, "error");
      const errorMsg: ChatMessage = { 
        id: `chat-${Date.now()}-err`, 
        role: "model", 
        text: `Maaf, saya gagal terhubung ke proxy Gemini. Pastikan server Anda aktif serta GEMINI_API_KEY dikonfigurasi pada Settings > Secrets. \n\nDetail: ${err.message}` 
      };
      setChatHistory((prev) => [...prev, errorMsg]);
    } finally {
      setIsGeneratingChat(false);
    }
  };

  // Save Dynamic configuration to localStorage & reload Page
  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customConfig.apiKey || !customConfig.projectId) {
      dispatchToast("Harap isi Api Key dan Project ID!", "warning");
      return;
    }
    localStorage.setItem("mpaistudycove_firebase_config", JSON.stringify(customConfig));
    setShowConfigModal(false);
    dispatchToast("Konfigurasi disimpan! Memuat ulang sistem...", "success");
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  };

  const handleResetConfig = () => {
    localStorage.removeItem("mpaistudycove_firebase_config");
    dispatchToast("Konfigurasi direset ke bawaan. Memuat ulang...", "info");
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  };

  // Rendering Helper: List of upcoming presenters from group tasks
  const upcomingPresenters = assignments
    .filter((as) => (as.assignmentType === "kelompok" || as.studentName?.toLowerCase().startsWith("kelompok")) && (as.presentationDate || as.dueDate))
    .map((as) => ({
      id: as.id,
      groupName: as.studentName,
      subject: as.subject,
      taskType: as.taskType || "Presentasi",
      date: as.presentationDate || as.dueDate || "",
      members: as.groupMembers || as.nim?.replace("Anggota: ", "") || "-",
      fileUrl: as.fileUrl
    }))
    .sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime());

  // Rendering Helper: Lists of schedules filtered by active search
  const filteredSchedules = schedules.filter((s) => {
    const matchesDay = scheduleDayFilter === "Semua" || s.day === scheduleDayFilter;
    const matchesQuery = s.subject.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         s.lecturer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDay && matchesQuery;
  });

  // Rendering Helper: Book library filtered by search and category
  const filteredLibrary = library.filter((l) => {
    const matchesCat = libraryFilter === "Semua" || l.category === libraryFilter;
    const matchesQuery = l.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         l.author.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesQuery;
  });

  // Main UI Render
  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-powdery-bg">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-powdery-accent-dark border-t-transparent rounded-full mb-4"
        />
        <p className="text-powdery-dark-text font-display font-medium text-lg animate-pulse">
          Menginisialisasi Hub Akademik S1 MPAI...
        </p>
      </div>
    );
  }

  // Authentic Student Auth Screen (Login / Register) If logged-out
  if (!currentUser) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden bg-gradient-to-tr from-powdery-bg to-[#DCEDF2]">
        {/* Visual Soft Powdery Bubbles decor */}
        <div className="absolute top-20 left-10 w-72 h-72 rounded-full bg-powdery-accent-light opacity-50 blur-3xl -z-10" />
        <div className="absolute bottom-10 right-10 w-96 h-96 rounded-full bg-powdery-accent-mid opacity-30 blur-3xl -z-10" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md p-8 rounded-3xl glass-panel-solid relative"
        >
          {/* Logo Brand S1 MPAI */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-powdery-accent-mid flex items-center justify-center text-powdery-accent-dark mb-4 shadow-glass-sm">
              <BookOpen className="w-8 h-8" />
            </div>
            <h1 className="text-3xl font-display font-bold text-powdery-dark-text tracking-tight text-center">
              Study Cove
            </h1>
            <p className="text-sm text-gray-500 font-medium tracking-wide mt-1 text-center">
              Portal Akademik Mahasiswa S1 MPAI
            </p>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {isRegistering && (
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">
                  Nama Lengkap Mahasiswa
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ahmad Mujahidin"
                  className="w-full px-4 py-3 rounded-xl glass-input text-sm text-powdery-dark-text font-medium"
                  value={authForm.name}
                  onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">
                E-mail Akademik / Mahasiswa
              </label>
              <input
                type="email"
                required
                placeholder="mpai.student@gmail.com"
                className="w-full px-4 py-3 rounded-xl glass-input text-sm text-powdery-dark-text font-medium"
                value={authForm.email}
                onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">
                Sandi Keamanan
              </label>
              <input
                type="password"
                required
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl glass-input text-sm text-powdery-dark-text font-medium"
                value={authForm.password}
                onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
              />
            </div>

            <button
              type="submit"
              className="w-full bg-powdery-accent-dark hover:bg-opacity-90 text-white py-3 rounded-xl font-display font-semibold shadow-md transition-all text-sm mt-6 cursor-pointer"
            >
              {isRegistering ? "Daftar sebagai Mahasiswa" : "Masuk ke Portal"}
            </button>
          </form>

          {/* Social login option */}
          <div className="mt-6 text-center">
            <span className="text-xs text-gray-400 font-semibold tracking-wider uppercase">— ATAU —</span>
            <button
              onClick={handleGoogleLogin}
              className="w-full mt-4 flex items-center justify-center gap-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 py-3 rounded-xl font-medium transition duration-200 text-sm shadow-sm cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              Masuk dengan Akun Akademik
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-100 flex items-center justify-between text-xs font-semibold">
            <button
              onClick={() => setIsRegistering(!isRegistering)}
              className="text-powdery-accent-dark hover:underline cursor-pointer"
            >
              {isRegistering ? "Sudah terdaftar? Masuk di sini" : "Mahasiswa baru? Register di sini"}
            </button>

            <button
              onClick={() => setShowConfigModal(true)}
              className="text-gray-400 hover:text-powdery-accent-dark flex items-center gap-1 cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" /> Set Firebase Config
            </button>
          </div>
        </motion.div>

        {/* Floating manual toast manager during auth */}
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm">
          {toasts.map((t) => (
            <div key={t.id} className="p-4 rounded-xl flex items-center gap-3 shadow-md glass-panel-solid border-l-4 border-powdery-accent-dark">
              <Info className="text-powdery-accent-dark w-5 h-5 flex-shrink-0" />
              <span className="text-xs font-medium">{t.text}</span>
            </div>
          ))}
        </div>

        {/* Dynamic configuration Modal */}
        <AnimatePresence>
          {showConfigModal && (
            <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-md p-6 rounded-2xl glass-panel-solid"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display font-bold text-lg">Firebase Connection Settings</h3>
                  <button onClick={() => setShowConfigModal(false)} className="text-gray-400 hover:text-black cursor-pointer">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-xs text-gray-500 mb-4 font-medium leading-relaxed">
                  Masukkan berkas konfigurasi Web SDK proyek Firebase Anda agar tersambung secara live ke Firestore dan Storage milik Anda pribadi.
                </p>

                <form onSubmit={handleSaveConfig} className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 mb-0.5 uppercase tracking-wider">api key</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 text-xs rounded-lg glass-input"
                      placeholder="AIzaSyA..."
                      value={customConfig.apiKey}
                      onChange={(e) => setCustomConfig({ ...customConfig, apiKey: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 mb-0.5 uppercase tracking-wider">auth domain</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 text-xs rounded-lg glass-input"
                      placeholder="project-id.firebaseapp.com"
                      value={customConfig.authDomain}
                      onChange={(e) => setCustomConfig({ ...customConfig, authDomain: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 mb-0.5 uppercase tracking-wider">project id</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 text-xs rounded-lg glass-input"
                      placeholder="project-id"
                      value={customConfig.projectId}
                      onChange={(e) => setCustomConfig({ ...customConfig, projectId: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 mb-0.5 uppercase tracking-wider">storage bucket</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 text-xs rounded-lg glass-input"
                      placeholder="project-id.appspot.com"
                      value={customConfig.storageBucket}
                      onChange={(e) => setCustomConfig({ ...customConfig, storageBucket: e.target.value })}
                    />
                  </div>

                  <div className="flex gap-2 pt-4">
                    <button
                      type="button"
                      onClick={handleResetConfig}
                      className="flex-1 bg-red-50 text-red-600 text-xs font-semibold py-2 rounded-lg cursor-pointer hover:bg-red-100"
                    >
                      Reset Bawaan
                    </button>
                    <button
                      type="submit"
                      className="flex-1 bg-powdery-accent-dark hover:bg-opacity-90 text-white text-xs font-semibold py-2 rounded-lg cursor-pointer"
                    >
                      Simpan & Sambungkan
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Notification Utility Functions
  const getAnnouncementTime = (ann: Announcement) => {
    if (!ann.createdAt) return 0;
    if (ann.createdAt.seconds) {
      return ann.createdAt.seconds * 1000;
    }
    const parsed = Date.parse(ann.createdAt);
    return isNaN(parsed) ? 0 : parsed;
  };

  const unreadAnnouncements = announcements.filter(
    (ann) => !readAnnouncementIds.includes(ann.id)
  );

  const handleMarkAllAsRead = () => {
    const allIds = announcements.map((ann) => ann.id);
    setReadAnnouncementIds(allIds);
    localStorage.setItem("study_cove_read_ann_ids", JSON.stringify(allIds));
    dispatchToast("Semua pengumuman telah ditandai dibaca.", "success");
  };

  const handleAnnClick = (ann: Announcement) => {
    if (!readAnnouncementIds.includes(ann.id)) {
      const updated = [...readAnnouncementIds, ann.id];
      setReadAnnouncementIds(updated);
      localStorage.setItem("study_cove_read_ann_ids", JSON.stringify(updated));
    }
    setShowBellDropdown(false);
    setActiveTab("dashboard");
    setTimeout(() => {
      document.getElementById(`announcement-card-${ann.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

  // LOGGED IN PORTAL VIEW RENDER
  return (
    <div className="min-h-screen pb-20 relative">
      {/* Background Ambience */}
      <div className="fixed top-0 left-0 w-full h-[320px] bg-gradient-to-b from-[#DCEDF2] to-powdery-bg -z-10" />

      {/* HEADER SECTION */}
      <header id="portal-header" className="max-w-7xl mx-auto px-4 pt-6 pb-2">
        <div className="glass-panel p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-powdery-accent-mid text-powdery-accent-dark flex items-center justify-center shadow-glass-sm shrink-0">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-display font-extrabold text-powdery-dark-text leading-tight">
                Study Cove Portal
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] bg-white font-bold text-powdery-accent-dark px-2 py-0.5 rounded-full shadow-glass-sm border border-powdery-accent-light">
                  S1 Manajemen Pendidikan Agama Islam
                </span>
                <span className={`text-[10px] font-bold flex items-center gap-1 ${isFirebaseInitialized ? "text-emerald-600" : "text-amber-600"}`}>
                  <span className={`inline-block w-2 py-2 rounded-full ${isFirebaseInitialized ? "bg-emerald-500 animate-pulse" : "bg-amber-400"}`} />
                  {isFirebaseInitialized ? "Live Firestore" : "Demo Mode"}
                </span>
              </div>
            </div>
          </div>

          {/* User profile, Tour guide Trigger and Logout */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            {/* Real-time Notification Bell Icon */}
            <div className="relative">
              <button
                onClick={() => setShowBellDropdown(!showBellDropdown)}
                className="relative p-2.5 rounded-xl bg-white/70 hover:bg-white text-powdery-accent-dark shadow-sm border border-powdery-accent-light cursor-pointer flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
                title="Notifikasi Pengumuman"
                id="notification-bell-btn"
              >
                <Bell className={`w-4 h-4 ${unreadAnnouncements.length > 0 ? "animate-bounce text-red-500" : ""}`} />
                {unreadAnnouncements.length > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-red-500 text-[9px] font-extrabold text-white ring-2 ring-white animate-pulse">
                    {unreadAnnouncements.length}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {showBellDropdown && (
                  <>
                    {/* Invisible click backdrop to dismiss dropdown */}
                    <div className="fixed inset-0 z-40" onClick={() => setShowBellDropdown(false)} />
                    
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-80 max-h-[420px] rounded-2xl bg-white border border-powdery-accent-light shadow-xl p-4 z-50 flex flex-col gap-3 text-left overflow-hidden sm:right-0 -right-10"
                    >
                      <div className="flex items-center justify-between border-b border-powdery-accent-light pb-2 shrink-0">
                        <div className="flex items-center gap-1.5">
                          <BellRing className="w-4 h-4 text-powdery-accent-dark" />
                          <h4 className="text-xs font-display font-extrabold text-powdery-dark-text">
                            Pengumuman Real-Time
                          </h4>
                        </div>
                        {unreadAnnouncements.length > 0 && (
                          <button
                            onClick={handleMarkAllAsRead}
                            className="text-[10px] text-powdery-accent-dark hover:underline font-bold cursor-pointer"
                          >
                            Tandai semua dibaca
                          </button>
                        )}
                      </div>

                      <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2 max-h-[250px] no-scrollbar">
                        {announcements.length === 0 ? (
                          <div className="text-center py-8 text-gray-400 text-xs font-semibold">
                            Belum ada pengumuman prodi.
                          </div>
                        ) : (
                          announcements.slice(0, 5).map((ann) => {
                            const isUnread = unreadAnnouncements.some((ua) => ua.id === ann.id);
                            return (
                              <div
                                key={ann.id}
                                onClick={() => handleAnnClick(ann)}
                                className={`p-2.5 rounded-xl transition cursor-pointer text-xs border text-left ${
                                  isUnread
                                    ? "bg-powdery-accent-light/40 hover:bg-powdery-accent-light border-powdery-accent-mid border-l-4 border-l-powdery-accent-dark"
                                    : "bg-gray-50/50 hover:bg-gray-50 border-gray-100 hover:border-gray-200"
                                }`}
                              >
                                <div className="flex items-center justify-between font-bold text-powdery-dark-text leading-tight mb-1">
                                  <span className="truncate max-w-[190px]">{ann.title}</span>
                                  {isUnread && (
                                    <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                                  )}
                                </div>
                                <p className="text-[10px] text-gray-500 line-clamp-2 leading-relaxed mb-1 font-medium">
                                  {ann.content}
                                </p>
                                <div className="flex justify-between items-center text-[9px] text-gray-400 font-semibold">
                                  <span>{ann.writer}</span>
                                  <span>
                                    {new Date(getAnnouncementTime(ann)).toLocaleDateString("id-ID", {
                                      day: "numeric",
                                      month: "short"
                                    })}
                                  </span>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      <div className="border-t border-powdery-accent-light pt-2 shrink-0 text-center">
                        <button
                          onClick={() => {
                            setActiveTab("dashboard");
                            setShowBellDropdown(false);
                            setTimeout(() => {
                              document.getElementById("portal-header")?.scrollIntoView({ behavior: "smooth" });
                            }, 100);
                          }}
                          className="text-[10px] font-bold text-powdery-accent-dark hover:underline flex items-center justify-center gap-1 mx-auto cursor-pointer"
                        >
                          Lihat semua di mading <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            <button
              onClick={triggerManualTour}
              className="p-2 rounded-xl bg-white/70 hover:bg-white text-powdery-accent-dark shadow-sm border border-powdery-accent-light cursor-pointer flex items-center gap-1 text-xs font-semibold"
            >
              <HelpCircle className="w-4 h-4" /> Bimbingan Tour
            </button>

            {isAdminMode && (
              <span className="text-xs bg-red-100 text-red-700 font-bold px-3 py-1.5 rounded-xl border border-red-200">
                ADMIN ACCESS
              </span>
            )}

            <div className="flex items-center gap-2 bg-white/80 border border-powdery-accent-light p-1.5 rounded-xl">
              <div className="w-8 h-8 rounded-lg bg-powdery-accent-light text-powdery-accent-dark font-display font-medium text-xs flex items-center justify-center border border-powdery-accent-mid capitalize shadow-glass-sm">
                {currentUser?.displayName ? currentUser.displayName.slice(0, 2) : currentUser?.email?.slice(0, 2)}
              </div>
              <div className="hidden sm:block text-left text-xs pr-2">
                <p className="font-bold text-powdery-dark-text truncate max-w-[120px]">
                  {currentUser?.displayName || currentUser?.email?.split("@")[0]}
                </p>
                <p className="text-[10px] text-gray-400">Mahasiswa S1</p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="p-2.5 rounded-xl bg-white hover:bg-red-50 text-red-500 hover:text-red-600 border border-red-100 cursor-pointer shadow-glass-sm"
              title="Keluar"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* CORE NAVIGATION BAR */}
      <nav id="navigation-bar" className="max-w-7xl mx-auto px-4 mt-6">
        <div className="glass-panel p-2 rounded-2xl flex items-center justify-start gap-1 overflow-x-auto no-scrollbar scroll-smooth">
          <button
            onClick={() => { setActiveTab("dashboard"); setSearchQuery(""); }}
            className={`px-4 py-2.5 rounded-xl text-xs font-display font-bold flex items-center gap-2 cursor-pointer shrink-0 transition ${
              activeTab === "dashboard"
                ? "bg-powdery-accent-dark text-white font-medium shadow-md"
                : "text-powdery-dark-text hover:bg-white/40"
            }`}
          >
            <Megaphone className="w-4 h-4" /> Beranda & Jadwal
          </button>
          
          <button
            onClick={() => { setActiveTab("treasury"); setSearchQuery(""); }}
            className={`px-4 py-2.5 rounded-xl text-xs font-display font-bold flex items-center gap-2 cursor-pointer shrink-0 transition ${
              activeTab === "treasury"
                ? "bg-powdery-accent-dark text-white font-medium shadow-md"
                : "text-powdery-dark-text hover:bg-white/40"
            }`}
          >
            <Coins className="w-4 h-4" /> Kas Kelas
          </button>

          <button
            onClick={() => { setActiveTab("assignments"); setSearchQuery(""); }}
            className={`px-4 py-2.5 rounded-xl text-xs font-display font-bold flex items-center gap-2 cursor-pointer shrink-0 transition ${
              activeTab === "assignments"
                ? "bg-powdery-accent-dark text-white font-medium shadow-md"
                : "text-powdery-dark-text hover:bg-white/40"
            }`}
          >
            <ClipboardList className="w-4 h-4" /> Pengumpulan Tugas
          </button>

          <button
            onClick={() => { setActiveTab("groups"); setSearchQuery(""); }}
            className={`px-4 py-2.5 rounded-xl text-xs font-display font-bold flex items-center gap-2 cursor-pointer shrink-0 transition ${
              activeTab === "groups"
                ? "bg-powdery-accent-dark text-white font-medium shadow-md"
                : "text-powdery-dark-text hover:bg-white/40"
            }`}
          >
            <Users className="w-4 h-4" /> Kelompok Belajar
          </button>

          <button
            onClick={() => { setActiveTab("library"); setSearchQuery(""); }}
            className={`px-4 py-2.5 rounded-xl text-xs font-display font-bold flex items-center gap-2 cursor-pointer shrink-0 transition ${
              activeTab === "library"
                ? "bg-powdery-accent-dark text-white font-medium shadow-md"
                : "text-powdery-dark-text hover:bg-white/40"
            }`}
          >
            <BookMarked className="w-4 h-4" /> Perpustakaan
          </button>
        </div>
      </nav>

      {/* CORE VIEWPORT LAYOUT */}
      <main className="max-w-7xl mx-auto px-4 mt-6">
        <AnimatePresence mode="wait">
          {/* TABS 1: DASHBOARD (ANNOUNCEMENTS & SCHEDULES) */}
          {activeTab === "dashboard" && (
            <motion.div
              key="dashboard-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6"
            >
              {/* Primary announcements block */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-display font-bold flex items-center gap-2 text-powdery-dark-text">
                    <Megaphone className="w-5 h-5 text-powdery-accent-dark" /> Mading Pengumuman Akademik
                  </h3>
                  {isAdminMode && (
                    <span className="text-xs text-powdery-accent-dark font-semibold">Mode Admin Mengedit</span>
                  )}
                </div>

                {/* Announcement Addition Form (Admin-only) */}
                {isAdminMode && (
                  <form onSubmit={handleAddAnnouncement} className="p-5 rounded-2xl glass-panel-solid border border-powdery-accent-mid space-y-3">
                    <h4 className="text-xs font-bold text-powdery-accent-dark uppercase tracking-wider">tambah pengumuman prodi</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <input
                        type="text"
                        placeholder="Judul Pengumuman"
                        required
                        className="px-3 py-2 text-xs rounded-lg glass-input text-powdery-dark-text font-medium"
                        value={newAnnouncement.title}
                        onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
                      />
                      <input
                        type="text"
                        placeholder="Penulis (e.g. Kaprodi S1 MPAI)"
                        required
                        className="px-3 py-2 text-xs rounded-lg glass-input text-powdery-dark-text font-medium"
                        value={newAnnouncement.writer}
                        onChange={(e) => setNewAnnouncement({ ...newAnnouncement, writer: e.target.value })}
                      />
                    </div>
                    <textarea
                      placeholder="Isi konten pengumuman lengkap..."
                      rows={3}
                      required
                      className="w-full px-3 py-2 text-xs rounded-lg glass-input text-powdery-dark-text font-medium"
                      value={newAnnouncement.content}
                      onChange={(e) => setNewAnnouncement({ ...newAnnouncement, content: e.target.value })}
                    />
                    <div className="flex justify-end">
                      <button type="submit" className="px-4 py-1.5 bg-powdery-accent-dark hover:bg-opacity-90 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer shadow-sm">
                        <Plus className="w-3.5 h-3.5" /> Terbitkan Pengumuman
                      </button>
                    </div>
                  </form>
                )}

                {/* announcements logs list */}
                {announcements.length === 0 ? (
                  <div className="p-8 text-center rounded-2xl glass-panel text-gray-400 text-xs font-medium">
                    Belum terdapat berkas pengumuman akademik terbaru.
                  </div>
                ) : (
                  announcements.map((ann) => {
                    const isUnread = unreadAnnouncements.some((ua) => ua.id === ann.id);
                    return (
                      <div
                        key={ann.id}
                        id={`announcement-card-${ann.id}`}
                        className={`p-6 rounded-2xl glass-panel border hover:shadow-glass-hover transition relative group ${
                          isUnread
                            ? "border-powdery-accent-dark/40 ring-1 ring-powdery-accent-dark/20 bg-powdery-accent-light/10"
                            : "border-white/60"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] tracking-wide bg-powdery-accent-light text-powdery-accent-dark px-2.5 py-0.5 rounded-full font-bold">
                            {ann.writer}
                          </span>
                          <span className="text-[10px] text-gray-400 font-medium">
                            {new Date(ann.createdAt?.seconds ? ann.createdAt.seconds * 1000 : ann.createdAt).toLocaleDateString("id-ID")}
                          </span>
                        </div>
                        <h4 className="font-display font-extrabold text-base text-powdery-dark-text mb-2 tracking-tight flex items-center gap-2">
                          {ann.title}
                          {isUnread && (
                            <span className="inline-block h-2 w-2 rounded-full bg-red-500 animate-pulse" title="Baru" />
                          )}
                        </h4>
                        <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line font-medium">
                          {ann.content}
                        </p>

                        <div className="mt-4 flex justify-between items-center">
                          {isUnread && (
                            <button
                              onClick={() => {
                                const updated = [...readAnnouncementIds, ann.id];
                                setReadAnnouncementIds(updated);
                                localStorage.setItem("study_cove_read_ann_ids", JSON.stringify(updated));
                              }}
                              className="text-[10px] text-powdery-accent-dark hover:underline font-bold cursor-pointer"
                            >
                              Tandai dibaca
                            </button>
                          )}
                          
                          {isAdminMode && (
                            <button
                              onClick={() => performDelete("announcements", ann.id)}
                              className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg cursor-pointer ml-auto"
                              title="Hapus"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Schedules module partition */}
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-display font-bold flex items-center gap-2 text-powdery-dark-text">
                    <Calendar className="w-5 h-5 text-powdery-accent-dark" /> Jadwal Perkuliahan S1
                  </h3>
                  <div className="flex gap-1">
                    <select
                      className="px-2 py-1 text-[10px] rounded-lg border border-powdery-accent-light bg-white font-bold"
                      value={scheduleDayFilter}
                      onChange={(e) => setScheduleDayFilter(e.target.value)}
                    >
                      <option value="Semua">Semua Hari</option>
                      <option value="Senin">Senin</option>
                      <option value="Selasa">Selasa</option>
                      <option value="Rabu">Rabu</option>
                      <option value="Kamis">Kamis</option>
                      <option value="Jumat">Jumat</option>
                    </select>
                  </div>
                </div>

                {/* Calendar element CRUD addition */}
                {isAdminMode && (
                  <form onSubmit={handleAddSchedule} className="p-4 rounded-xl glass-panel-solid border border-powdery-accent-mid space-y-2">
                    <h4 className="text-[10px] font-bold text-powdery-accent-dark uppercase tracking-wider">tambah baris kelas</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        className="px-2 py-1.5 text-xs rounded-lg glass-input bg-white font-semibold"
                        value={newSchedule.day}
                        onChange={(e) => setNewSchedule({ ...newSchedule, day: e.target.value })}
                      >
                        <option value="Senin">Senin</option>
                        <option value="Selasa">Selasa</option>
                        <option value="Rabu">Rabu</option>
                        <option value="Kamis">Kamis</option>
                        <option value="Jumat">Jumat</option>
                      </select>
                      <input
                        type="text"
                        placeholder="Mata Kuliah (Matkul)"
                        required
                        className="px-2 py-1.5 text-xs rounded-lg glass-input text-powdery-dark-text font-medium"
                        value={newSchedule.subject}
                        onChange={(e) => setNewSchedule({ ...newSchedule, subject: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Jam (e.g. 08:30-11:00)"
                        required
                        className="px-2 py-1.5 text-xs rounded-lg glass-input text-powdery-dark-text font-medium"
                        value={newSchedule.time}
                        onChange={(e) => setNewSchedule({ ...newSchedule, time: e.target.value })}
                      />
                      <input
                        type="text"
                        placeholder="Dosen S1"
                        required
                        className="px-2 py-1.5 text-xs rounded-lg glass-input text-powdery-dark-text font-medium"
                        value={newSchedule.lecturer}
                        onChange={(e) => setNewSchedule({ ...newSchedule, lecturer: e.target.value })}
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Ruang Kuliah (e.g. R. Sidang 2)"
                      required
                      className="w-full px-2 py-1.5 text-xs rounded-lg glass-input text-powdery-dark-text font-medium"
                      value={newSchedule.room}
                      onChange={(e) => setNewSchedule({ ...newSchedule, room: e.target.value })}
                    />
                    <div className="flex justify-end pt-1">
                      <button type="submit" className="px-3 py-1 bg-powdery-accent-dark text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer">
                        <Plus className="w-3.5 h-3.5" /> Tambah Kelas
                      </button>
                    </div>
                  </form>
                )}

                {/* Schedules list display */}
                <div className="space-y-3">
                  {filteredSchedules.length === 0 ? (
                    <div className="p-8 text-center rounded-2xl glass-panel text-gray-400 text-xs font-medium">
                      Jadwal kosong atau tidak cocok dengan filter.
                    </div>
                  ) : (
                    filteredSchedules.map((sch) => (
                      <div key={sch.id} className="p-4 rounded-xl glass-panel-solid border border-white/40 flex items-start justify-between relative group shadow-glass-sm animate-fade-in">
                        <div className="space-y-1 pr-6">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] bg-powdery-accent-dark text-white font-bold px-2 py-0.5 rounded-full capitalize">
                              {sch.day}
                            </span>
                            <span className="text-[10px] text-gray-500 font-mono font-bold">{sch.time}</span>
                          </div>
                          <h4 className="font-display font-extrabold text-sm text-powdery-dark-text">
                            {sch.subject}
                          </h4>
                          <p className="text-[11px] text-gray-500 font-semibold flex items-center gap-1">
                            <User className="w-3 h-3 text-powdery-accent-dark" /> {sch.lecturer}
                          </p>
                          <p className="text-[10px] text-powdery-accent-dark font-bold font-mono tracking-wide bg-powdery-accent-light inline-block px-1.5 py-0.5 rounded">
                            {sch.room}
                          </p>
                        </div>

                        {isAdminMode && (
                          <button
                            onClick={() => performDelete("schedules", sch.id)}
                            className="absolute top-3 right-3 p-1 text-red-500 hover:bg-red-50 rounded-lg cursor-pointer"
                            title="Hapus"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Upcoming Presenters Widget Board */}
                <div className="pt-5 border-t border-powdery-accent-mid/30 space-y-3">
                  <h3 className="text-sm font-display font-bold flex items-center gap-2 text-powdery-dark-text uppercase tracking-wider">
                    <Users className="w-4 h-4 text-powdery-accent-dark" /> Upcoming Presenters 👥✨
                  </h3>
                  
                  {upcomingPresenters.length === 0 ? (
                    <div className="p-4 rounded-xl bg-powdery-accent-light/35 border border-powdery-accent-mid/30 text-center text-[11px] text-gray-500 font-medium">
                      Belum ada jadwal presentasi kelompok terdaftar. Unggah berkas tugas kelompok baru untuk mengisi jadwal!
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {upcomingPresenters.slice(0, 4).map((pres) => (
                        <div key={pres.id} className="p-4 rounded-xl bg-white/60 border border-powdery-accent-mid/30 shadow-glass-sm hover:translate-y-[-1px] transition-all duration-200">
                          <div className="flex justify-between items-start gap-2 mb-2">
                            <span className="text-[10px] bg-rose-50 border border-rose-100 text-rose-700 font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                              <span>📅</span>
                              <span>
                                {new Date(pres.date).toLocaleDateString("id-ID", { day: 'numeric', month: 'short', year: 'numeric' })}
                              </span>
                            </span>
                            <span className="text-[9px] bg-powdery-accent-light text-powdery-accent-dark font-extrabold px-2 py-0.5 rounded-md uppercase">
                              {pres.taskType}
                            </span>
                          </div>
                          <h4 className="text-xs font-bold text-powdery-dark-text leading-tight">{pres.groupName}</h4>
                          <p className="text-[11px] font-semibold text-gray-600 mt-1">{pres.subject}</p>
                          <p className="text-[10px] text-gray-500 font-medium mt-1 leading-snug">
                            <span className="font-bold text-powdery-accent-dark">Anggota:</span> {pres.members}
                          </p>
                          {pres.fileUrl && (
                            <a
                              href={pres.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 mt-2.5 text-[10px] font-bold text-powdery-accent-dark hover:underline"
                            >
                              <FileText className="w-3 h-3" /> Berkas / PPT Presentasi
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* TABS 2: TREASURY (KAS KELAS) */}
          {activeTab === "treasury" && (
            <motion.div
              key="treasury-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Financial Balance Summary Banner */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-6 rounded-2xl bg-gradient-to-tr from-powdery-accent-dark to-[#3B6E7E] text-white shadow-md relative overflow-hidden">
                  <div className="absolute right-3 bottom-0 text-white/10 w-24 h-24 overflow-hidden -mr-4 -mb-4">
                    <Coins className="w-full h-full" />
                  </div>
                  <h4 className="text-[10px] uppercase font-bold tracking-widest text-[#B2D8E4] mb-1">total kas terkumpul</h4>
                  <p className="text-3xl font-display font-bold">
                    Rp {(treasury.filter((t) => t.status === "Lunas").length * 20000).toLocaleString("id-ID")}
                  </p>
                  <p className="text-[10px] font-medium text-[#CBE7F0] mt-2">Dihitung dari log pembayaran berstatus lunas</p>
                </div>

                <div className="p-6 rounded-2xl glass-panel-solid border-l-4 border-emerald-400">
                  <h4 className="text-[10px] uppercase font-bold tracking-widest text-gray-400 mb-1">jumlah mahasiswa lunas</h4>
                  <p className="text-3xl font-display font-extrabold text-emerald-600">
                    {treasury.filter((t) => t.status === "Lunas").length} <span className="text-sm font-medium text-gray-500">Orang</span>
                  </p>
                  <p className="text-[10px] font-semibold text-gray-400 mt-2">Daftar iuran kas kelas prodi s1 semester aktif</p>
                </div>

                <div className="p-6 rounded-2xl glass-panel-solid border-l-4 border-amber-400">
                  <h4 className="text-[10px] uppercase font-bold tracking-widest text-gray-400 mb-1">jumlah menunggak</h4>
                  <p className="text-3xl font-display font-extrabold text-amber-600">
                    {treasury.filter((t) => t.status === "Belum Lunas").length} <span className="text-sm font-medium text-gray-500">Orang</span>
                  </p>
                  <p className="text-[10px] font-semibold text-gray-400 mt-2">Pemberitahuan wajib agar segera menyetorkan!</p>
                </div>
              </div>

              {/* Adding Treasury Data Form (Admin-only) */}
              {isAdminMode && (
                <form onSubmit={handleAddTreasury} className="p-5 rounded-2xl glass-panel border border-powdery-accent-mid space-y-3">
                  <h4 className="text-xs font-bold text-powdery-accent-dark uppercase tracking-wider">Tambah / Perbarui Riwayat Kas Swadaya</h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <input
                      type="text"
                      placeholder="Nama Lengkap Mahasiswa"
                      required
                      className="px-3 py-2 text-xs rounded-lg glass-input text-powdery-dark-text font-medium col-span-1 md:col-span-2"
                      value={newTreasury.studentName}
                      onChange={(e) => setNewTreasury({ ...newTreasury, studentName: e.target.value })}
                    />
                    <input
                      type="text"
                      placeholder="NIM S1 MPAI"
                      required
                      className="px-3 py-2 text-xs rounded-lg glass-input text-powdery-dark-text font-medium"
                      value={newTreasury.nim}
                      onChange={(e) => setNewTreasury({ ...newTreasury, nim: e.target.value })}
                    />
                    <select
                      className="px-3 py-2 text-xs rounded-lg glass-input font-bold bg-white"
                      value={newTreasury.status}
                      onChange={(e) => setNewTreasury({ ...newTreasury, status: e.target.value as "Lunas" | "Belum Lunas" })}
                    >
                      <option value="Lunas">Lunas (Rp 20.000)</option>
                      <option value="Belum Lunas">Belum Lunas</option>
                    </select>
                  </div>
                  <div className="flex justify-end pt-1">
                    <button type="submit" className="px-4 py-1.5 bg-powdery-accent-dark text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer">
                      <Plus className="w-3.5 h-3.5" /> Simpan Data Kas
                    </button>
                  </div>
                </form>
              )}

              {/* Searching index and Table */}
              <div className="glass-panel p-6 rounded-2xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                  <h3 className="font-display font-extrabold text-base text-powdery-dark-text leading-tight flex items-center gap-2">
                    <Coins className="w-5 h-5 text-powdery-accent-dark" /> Buku Besar Kas & Anggota S1 MPAI
                  </h3>
                  <div className="relative">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Cari Mahasiswa S1 / NIM..."
                      className="pl-9 pr-4 py-2 text-xs rounded-xl glass-input w-full sm:w-[260px]"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl">
                  <table className="w-full text-xs text-left text-gray-600">
                    <thead className="bg-powdery-accent-light text-[10px] uppercase font-bold tracking-wider text-powdery-accent-dark">
                      <tr>
                        <th className="px-5 py-3">Nama Lengkap</th>
                        <th className="px-5 py-3">NIM MPAI</th>
                        <th className="px-5 py-3">Iuran Kas</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3 text-right">Terakhir Update</th>
                        {isAdminMode && <th className="px-5 py-3 text-center">Aksi</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-medium">
                      {treasury
                        .filter((t) =>
                          t.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          t.nim.includes(searchQuery)
                        )
                        .map((t) => (
                          <tr key={t.id} className="hover:bg-white/50 transition">
                            <td className="px-5 py-3.5 font-bold text-powdery-dark-text">{t.studentName}</td>
                            <td className="px-5 py-3.5 font-mono">{t.nim}</td>
                            <td className="px-5 py-3.5">Rp {t.amount.toLocaleString("id-ID")}</td>
                            <td className="px-5 py-3.5">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                t.status === "Lunas" ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                              }`}>
                                {t.status}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-right text-gray-400 font-mono text-[10px]">
                              {new Date(t.updatedAt?.seconds ? t.updatedAt.seconds * 1000 : t.updatedAt).toLocaleDateString("id-ID")}
                            </td>
                            {isAdminMode && (
                              <td className="px-5 py-3.5 text-center">
                                <button
                                  onClick={() => performDelete("treasury", t.id)}
                                  className="p-1 hover:bg-red-50 text-red-500 rounded-lg cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {/* TABS 3: ASSIGNMENTS (PENGUMPULAN TUGAS) */}
          {activeTab === "assignments" && (
            <motion.div
              key="assignments-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6"
              id="assignments-module"
            >
              {/* Form Upload & dual submission logger column */}
              <div className="space-y-4">
                <h3 className="text-lg font-display font-bold flex items-center gap-2 text-powdery-dark-text">
                  <ClipboardList className="w-5 h-5 text-powdery-accent-dark" /> Form Pengumpulan Berkas
                </h3>

                <form onSubmit={handleAssignmentSubmit} className="p-6 rounded-2xl glass-panel-solid space-y-4 shadow-glass">
                  {/* Tipe Tugas Switcher */}
                  <div className="bg-powdery-accent-light p-1 rounded-xl flex items-center border border-powdery-accent-mid">
                    <button
                      type="button"
                      onClick={() => setAssignmentForm({ ...assignmentForm, assignmentType: "individu" })}
                      className={`flex-1 py-1.5 text-center text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer ${
                        assignmentForm.assignmentType === "individu"
                          ? "bg-white text-powdery-accent-dark shadow-sm"
                          : "text-gray-500 hover:text-powdery-accent-dark"
                      }`}
                    >
                      Tugas Individu
                    </button>
                    <button
                      type="button"
                      onClick={() => setAssignmentForm({ ...assignmentForm, assignmentType: "kelompok" })}
                      className={`flex-1 py-1.5 text-center text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer ${
                        assignmentForm.assignmentType === "kelompok"
                          ? "bg-white text-powdery-accent-dark shadow-sm"
                          : "text-gray-500 hover:text-powdery-accent-dark"
                      }`}
                    >
                      Tugas Kelompok
                    </button>
                  </div>

                  {/* Kelompok Ke- (Only Kelompok) */}
                  {assignmentForm.assignmentType === "kelompok" && (
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Kelompok Ke- (Angka)</label>
                      <input
                        type="number"
                        required
                        min="1"
                        placeholder="Contoh: 1"
                        className="w-full px-4 py-2.5 rounded-xl glass-input text-xs text-powdery-dark-text font-medium bg-white"
                        value={assignmentForm.groupNumber}
                        onChange={(e) => setAssignmentForm({ ...assignmentForm, groupNumber: e.target.value })}
                      />
                    </div>
                  )}

                  {/* Mata Kuliah (Both) */}
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Mata Kuliah</label>
                    <select
                      className="w-full px-4 py-2.5 rounded-xl glass-input text-xs font-bold bg-white"
                      value={assignmentForm.subject}
                      onChange={(e) => {
                        const val = e.target.value;
                        let mappingLecturer = "Prof. Dr. KH. Muhaimin, M.A.";
                        if (val === "Administrasi Pendidikan Kontemporer") mappingLecturer = "Dr. Siti Aminah, M.Pd.";
                        if (val === "Metodologi Penelitian Pendidikan") mappingLecturer = "KH. Ahmad Ridwan, Ph.D.";
                        if (val === "Evaluasi Kurikulum PAI") mappingLecturer = "Dra. Lailatul Qadriah, M.Si.";
                        if (val === "Perencanaan & Manajemen Strategis") mappingLecturer = "Dr. Hasan Basri, M.Ag.";

                        setAssignmentForm({
                          ...assignmentForm,
                          subject: val,
                          lecturer: mappingLecturer
                        });
                      }}
                    >
                      <option value="Kepemimpinan Pendidikan Islam">Kepemimpinan Pendidikan Islam</option>
                      <option value="Administrasi Pendidikan Kontemporer">Administrasi Pendidikan Kontemporer</option>
                      <option value="Metodologi Penelitian Pendidikan">Metodologi Penelitian Pendidikan</option>
                      <option value="Evaluasi Kurikulum PAI">Evaluasi Kurikulum PAI</option>
                      <option value="Perencanaan & Manajemen Strategis">Perencanaan & Manajemen Strategis</option>
                    </select>
                  </div>

                  {/* Lecturer Tag */}
                  <div>
                    <label className="block text-xs font-bold text-gray-400 mb-1">NAMA DOSEN PENGAMPU</label>
                    <div className="px-4 py-2 text-xs bg-powdery-accent-light text-powdery-accent-dark font-bold rounded-xl border border-powdery-accent-mid">
                      {assignmentForm.lecturer}
                    </div>
                  </div>

                  {/* Nama Anggota Kelompok (Only Kelompok) */}
                  {assignmentForm.assignmentType === "kelompok" && (
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Nama Anggota Kelompok</label>
                      <textarea
                        required
                        rows={2}
                        placeholder="Contoh: Ahmad, Budi, Sinta"
                        className="w-full px-4 py-2.5 rounded-xl glass-input text-xs text-powdery-dark-text font-medium bg-white"
                        value={assignmentForm.groupMembers}
                        onChange={(e) => setAssignmentForm({ ...assignmentForm, groupMembers: e.target.value })}
                      />
                    </div>
                  )}

                  {/* Tanggal Presentasi (Only Kelompok) */}
                  {assignmentForm.assignmentType === "kelompok" && (
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Tanggal Presentasi Kelompok</label>
                        <span className="text-[9px] text-[#A6C0C9] font-bold uppercase tracking-wider bg-powdery-accent-light px-1.5 py-0.5 rounded">Opsional</span>
                      </div>
                      <input
                        type="date"
                        className="w-full px-4 py-2.5 rounded-xl glass-input text-xs text-powdery-dark-text font-medium bg-white"
                        value={assignmentForm.presentationDate}
                        onChange={(e) => setAssignmentForm({ ...assignmentForm, presentationDate: e.target.value })}
                      />
                    </div>
                  )}

                  {/* Tanggal Tenggat Waktu (Only Individu) */}
                  {assignmentForm.assignmentType === "individu" && (
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Tanggal Tenggat Waktu (Deadline)</label>
                      <input
                        type="date"
                        required
                        className="w-full px-4 py-2.5 rounded-xl glass-input text-xs text-powdery-dark-text font-medium bg-white"
                        value={assignmentForm.dueDate}
                        onChange={(e) => setAssignmentForm({ ...assignmentForm, dueDate: e.target.value })}
                      />
                    </div>
                  )}

                  {/* Jenis Tugas / Deskripsi Dropdown (Both) */}
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Deskripsi/Jenis Tugas</label>
                    <select
                      className="w-full px-4 py-2.5 rounded-xl glass-input text-xs font-bold bg-white"
                      value={assignmentForm.taskType}
                      onChange={(e) => setAssignmentForm({ ...assignmentForm, taskType: e.target.value as any })}
                    >
                      <option value="Jurnal">Jurnal</option>
                      <option value="Essay">Essay</option>
                      <option value="Makalah">Makalah</option>
                      <option value="PPT">PPT</option>
                      <option value="Unjuk Kerja">Unjuk Kerja</option>
                    </select>
                  </div>

                  {/* File Upload (Both) */}
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Unggah File PDF / Word (Max 10MB)</label>
                    <div className="border border-dashed border-powdery-accent-mid rounded-xl p-4 text-center bg-white/30 hover:bg-white/50 transition cursor-pointer relative">
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx"
                        required
                        onChange={handleFileChange}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                      <Upload className="w-8 h-8 mx-auto mb-2 text-powdery-accent-dark" />
                      <span className="text-xs text-gray-500 font-semibold block">
                        {assignmentForm.file ? assignmentForm.file.name : "Seret file ke sini atau Klik untuk memilih"}
                      </span>
                      <span className="text-[10px] text-gray-400 font-medium block mt-1">Mendukung format .pdf, .doc, .docx</span>
                    </div>
                  </div>

                  {/* Auto Log Info Notice for Individu */}
                  {assignmentForm.assignmentType === "individu" && (
                    <div className="p-3 bg-powdery-accent-light/50 rounded-xl border border-powdery-accent-mid/50 flex items-start gap-2">
                      <User className="w-4 h-4 text-powdery-accent-dark shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[10px] text-gray-500 font-bold block leading-tight">Mencatat Pengirim Otomatis:</span>
                        <span className="text-[11px] text-powdery-dark-text font-bold block mt-0.5">
                          {currentUser?.displayName || currentUser?.email?.split("@")[0]}
                        </span>
                      </div>
                    </div>
                  )}

                  {submittingAssignment && (
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[10px] font-bold text-powdery-accent-dark">
                        <span>Mengirim ke Firebase Storage...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                        <div className="bg-powdery-accent-dark h-full" style={{ width: `${uploadProgress}%` }} />
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submittingAssignment}
                    className="w-full bg-powdery-accent-dark hover:bg-opacity-90 text-white font-display font-semibold py-3 rounded-xl shadow-md transition-all text-xs cursor-pointer flex items-center justify-center gap-1"
                  >
                    <Upload className="w-3.5 h-3.5" /> {submittingAssignment ? "Sedang Mengirim..." : "Kirim Tugas ke Firebase"}
                  </button>
                </form>

                {/* WhatsApp Lecturer Notification triggers */}
                {lastUploadedUrl && (
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="p-5 rounded-2xl bg-emerald-50 border-2 border-emerald-100 space-y-3"
                    id="whatsapp-onboarding"
                  >
                    <div className="flex items-start gap-3">
                      <CheckCircle className="text-emerald-500 w-5 h-5 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-display font-extrabold text-sm text-emerald-800">
                          Pengumpulan Sukses!
                        </h4>
                        <p className="text-[11px] text-emerald-600 font-medium mt-1 leading-relaxed">
                          Tugas Anda berhasil terdaftar di basis data Firebase S1 MPAI. Silakan lakukan lapor bukti unggahan ke WhatsApp Dosen pengampu di bawah.
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={triggerWhatsAppRedirect}
                      className="w-full flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-xl text-xs shadow-sm transition border border-emerald-500"
                    >
                      <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24">
                        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.265 2.267 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.457L0 24zm6.59-4.846c1.6.95 3.1 1.45 4.8 1.45 5.516 0 10.003-4.49 10.006-10.01.002-2.673-1.033-5.187-2.918-7.076C16.652 1.63 14.137.59 11.465.59c-5.522 0-10.01 4.49-10.014 10.011-.002 1.9.497 3.5 1.442 5.143L1.83 22.01l6.417-1.683z" />
                      </svg>
                      Lapor ke WA Dosen
                    </button>
                  </motion.div>
                )}
              </div>

              {/* public transparent report grid S1 MPAI */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
                  <h3 className="text-lg font-display font-bold flex items-center gap-2 text-powdery-dark-text">
                    <ClipboardList className="w-5 h-5 text-powdery-accent-dark" /> Jurnal & Rekap Pengumpulan Tugas
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleDownloadCSV}
                      className="px-3 py-1.5 bg-powdery-accent-dark text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer hover:bg-opacity-90 transition shadow-glass-sm shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" /> Unduh Laporan CSV (Transparan)
                    </button>
                    <div className="relative shrink-0">
                      <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2" />
                      <input
                        type="text"
                        placeholder="Cari Mata Kuliah / Nama..."
                        className="pl-8 pr-3 py-1.5 text-[11px] rounded-lg border border-powdery-accent-light bg-white focus:outline-none"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="glass-panel p-5 rounded-2xl overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-powdery-accent-light text-[10px] uppercase font-bold tracking-wider text-powdery-accent-dark">
                        <th className="px-4 py-3">Mata Kuliah</th>
                        <th className="px-4 py-3 text-center">Tipe</th>
                        <th className="px-4 py-3">Deskripsi / Bab</th>
                        <th className="px-4 py-3">Pengumpul</th>
                        <th className="px-4 py-3 font-mono">NIM / Anggota</th>
                        <th className="px-4 py-3">Dosen</th>
                        <th className="px-4 py-3 text-center">Tenggat / Presentasi</th>
                        <th className="px-4 py-3 text-center">Berkas</th>
                        <th className="px-4 py-3 text-right">Tanggal Pengumpulan</th>
                        {isAdminMode && <th className="px-4 py-3 text-center">Hapus</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 font-medium">
                      {assignments.length === 0 ? (
                        <tr>
                          <td colSpan={isAdminMode ? 10 : 9} className="text-center py-8 text-gray-400">
                            Belum ada riwayat berkas tugas terkumpul. Mulai dengan mengunggah berkas pertama di samping!
                          </td>
                        </tr>
                      ) : (
                        assignments
                          .filter((as) => 
                            as.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            as.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            as.nim.toLowerCase().includes(searchQuery.toLowerCase())
                          )
                          .map((as) => (
                            <tr key={as.id} className="hover:bg-white/40 transition">
                              <td className="px-4 py-3.5 font-bold text-powdery-dark-text max-w-[150px] truncate">{as.subject}</td>
                              <td className="px-4 py-3.5 text-center">
                                <span className={`inline-block text-[9px] font-extrabold px-2 py-0.5 rounded-full ${
                                  as.assignmentType === "kelompok"
                                    ? "bg-purple-100/80 text-purple-700 border border-purple-200"
                                    : "bg-teal-100/80 text-teal-700 border border-teal-200"
                                }`}>
                                  {as.assignmentType === "kelompok" ? "Kelompok" : "Individu"}
                                </span>
                              </td>
                              <td className="px-4 py-3.5 font-semibold text-gray-600 max-w-[150px] truncate">{as.title}</td>
                              <td className="px-4 py-3.5 font-bold text-gray-700">{as.studentName}</td>
                              <td className="px-4 py-3.5">
                                {as.assignmentType === "kelompok" ? (
                                  <span className="text-[11px] text-gray-500 font-semibold block max-w-[150px] truncate" title={as.nim}>
                                    {as.nim}
                                  </span>
                                ) : (
                                  <span className="font-mono text-[11px] text-gray-400">{as.nim}</span>
                                )}
                              </td>
                              <td className="px-4 py-3.5 text-powdery-accent-dark font-semibold text-[11px]">{as.lecturer}</td>
                              <td className="px-4 py-3.5 text-center">
                                {as.dueDate ? (
                                  <span className="inline-block bg-rose-50 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded-md border border-rose-100">
                                    {new Date(as.dueDate).toLocaleDateString("id-ID", {
                                      day: "numeric",
                                      month: "short",
                                      year: "numeric"
                                    })}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </td>
                              <td className="px-4 py-3.5 text-center">
                                <a
                                  href={as.fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-powdery-accent-dark bg-powdery-accent-light px-2 py-0.5 rounded-md hover:bg-powdery-accent-mid/50 transition font-bold text-[10px]"
                                >
                                  <FileText className="w-3.5 h-3.5" /> PDF
                                </a>
                              </td>
                              <td className="px-4 py-3.5 text-right font-mono text-[10px] text-gray-400">
                                {new Date(as.createdAt?.seconds ? as.createdAt.seconds * 1000 : as.createdAt).toLocaleString("id-ID")}
                              </td>
                              {isAdminMode && (
                                <td className="px-3 py-3 text-center">
                                  <button
                                    onClick={() => performDelete("assignments", as.id)}
                                    className="p-1 hover:bg-red-50 text-red-500 rounded-lg cursor-pointer"
                                  >
                                    <Trash2 className="w-4.5 h-4.5" />
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {/* TABS 4: GROUPS (KELOMPOK - READ ONLY FOR STANDARD USERS) */}
          {activeTab === "groups" && (
            <motion.div
              key="groups-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-display font-bold flex items-center gap-2 text-powdery-dark-text">
                  <Users className="w-5 h-5 text-powdery-accent-dark" /> Pembagian Kelompok Belajar S1 MPAI
                </h3>
                <span className="text-xs text-gray-400 font-bold bg-white px-3 py-1 rounded-full border border-powdery-accent-light">
                  Status: Read Only
                </span>
              </div>

              {/* CRUD addition Form (Admin-Only) */}
              {isAdminMode && (
                <form onSubmit={handleAddGroup} className="p-5 rounded-2xl glass-panel-solid border border-powdery-accent-mid space-y-3">
                  <h4 className="text-xs font-bold text-powdery-accent-dark uppercase tracking-wider">tambah penataan kelompok baru</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Nama Kelompok (e.g. Kelompok 1 - Perencanaan Kurikulum)"
                      required
                      className="px-3 py-2 text-xs rounded-lg glass-input text-powdery-dark-text font-medium"
                      value={newGroup.name}
                      onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
                    />
                    <input
                      type="text"
                      placeholder="Anggota (Pisahkan dengan koma: Budi, Sinta, Zahrana)"
                      required
                      className="px-3 py-2 text-xs rounded-lg glass-input text-powdery-dark-text font-medium"
                      value={newGroup.members}
                      onChange={(e) => setNewGroup({ ...newGroup, members: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                    <div className="md:col-span-2">
                      <textarea
                        placeholder="Deskripsi tugas atau mufakat kelompok..."
                        rows={2}
                        className="w-full px-3 py-2 text-xs rounded-lg glass-input text-powdery-dark-text font-medium bg-white"
                        value={newGroup.description}
                        onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-wider">Status Kelompok</label>
                      <select
                        className="w-full px-3 py-2.5 text-xs rounded-lg glass-input text-powdery-dark-text font-bold bg-white"
                        value={newGroup.status}
                        onChange={(e) => setNewGroup({ ...newGroup, status: e.target.value as "Selesai" | "Belum Selesai" })}
                      >
                        <option value="Belum Selesai">Belum Selesai</option>
                        <option value="Selesai">Selesai</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button type="submit" className="px-4 py-1.5 bg-powdery-accent-dark hover:bg-opacity-90 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer">
                      <Plus className="w-3.5 h-3.5" /> Publikasi Kelompok
                    </button>
                  </div>
                </form>
              )}

              {/* Bento cards format display */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {groups.length === 0 ? (
                  <div className="col-span-full p-8 text-center rounded-2xl glass-panel text-gray-400 font-medium text-xs">
                    Belum ada pembagian kelompok belajar dari administrasi prodi.
                  </div>
                ) : (
                  groups.map((gp) => (
                    <div key={gp.id} className="p-6 rounded-2xl glass-panel relative flex flex-col justify-between border border-white/60 hover:shadow-glass-hover transition">
                      <div>
                        <div className="flex flex-col gap-1.5 mb-3 border-b border-gray-100 pb-2">
                          <h4 className="font-display font-extrabold text-base text-powdery-dark-text leading-tight pr-6">
                            {gp.name}
                          </h4>
                          <div>
                            <span className={`inline-block text-[9px] font-extrabold px-2 py-0.5 rounded-md border ${
                              gp.status === "Selesai"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                : "bg-purple-50 text-purple-700 border-purple-100"
                            }`}>
                              🟢 {gp.status || "Belum Selesai"}
                            </span>
                          </div>
                        </div>
                        {gp.description && (
                          <p className="text-xs text-gray-500 font-medium italic mb-4 leading-relaxed">
                            "{gp.description}"
                          </p>
                        )}

                        <div className="mt-2 space-y-1.5">
                          <label className="text-[10px] font-bold text-powdery-accent-dark uppercase tracking-wider block">Anggota Mahasiswa</label>
                          <div className="flex flex-wrap gap-1.5">
                            {gp.members.split(",").map((member, i) => (
                              <span key={i} className="text-xs bg-white text-gray-600 border border-gray-150 px-2.5 py-1 rounded-xl shadow-glass-sm inline-block font-semibold">
                                {member.trim()}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {isAdminMode && (
                        <button
                          onClick={() => performDelete("groups", gp.id)}
                          className="absolute top-4 right-4 p-1 text-red-500 hover:bg-red-50 rounded-lg cursor-pointer"
                          title="Hapus"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {/* TABS 5: LIBRARY (PERPUSTAKAAN) */}
          {activeTab === "library" && (
            <motion.div
              key="library-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Category switches and search bar */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 card shadow-glass-sm p-4 rounded-2xl bg-white/50">
                <div className="flex flex-wrap items-center gap-2">
                  {["Semua", "Administrasi Pendidikan", "Evaluasi Kurikulum", "Metodologi Penelitian", "Kepemimpinan Pendidikan Islam"].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setLibraryFilter(cat)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition ${
                        libraryFilter === cat
                          ? "bg-powdery-accent-dark text-white"
                          : "bg-white/80 hover:bg-white text-gray-600 border border-powdery-accent-light"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Cari buku / naskah..."
                    className="pl-9 pr-4 py-2 text-xs rounded-xl glass-input w-full md:w-[240px]"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              {/* CRUD addition form (Admin-Only) */}
              {isAdminMode && (
                <form onSubmit={handleAddLibrary} className="p-5 rounded-2xl glass-panel border border-powdery-accent-mid space-y-3">
                  <h4 className="text-xs font-bold text-powdery-accent-dark uppercase tracking-wider">tambah berkas madrasah / buku</h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <input
                      type="text"
                      placeholder="Judul Buku / Pembelajaran Akademis"
                      required
                      className="px-3 py-2 text-xs rounded-lg glass-input text-powdery-dark-text font-medium col-span-1 md:col-span-2"
                      value={newLibrary.title}
                      onChange={(e) => setNewLibrary({ ...newLibrary, title: e.target.value })}
                    />
                    <input
                      type="text"
                      placeholder="Dosen / Penulis"
                      required
                      className="px-3 py-2 text-xs rounded-lg glass-input text-powdery-dark-text font-medium"
                      value={newLibrary.author}
                      onChange={(e) => setNewLibrary({ ...newLibrary, author: e.target.value })}
                    />
                    <select
                      className="px-3 py-2 text-xs rounded-lg glass-input font-bold bg-white"
                      value={newLibrary.category}
                      onChange={(e) => setNewLibrary({ ...newLibrary, category: e.target.value })}
                    >
                      <option value="Administrasi Pendidikan">Administrasi Pendidikan</option>
                      <option value="Evaluasi Kurikulum">Evaluasi Kurikulum</option>
                      <option value="Metodologi Penelitian">Metodologi Penelitian</option>
                      <option value="Kepemimpinan Pendidikan Islam">Kepemimpinan Pendidikan Islam</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <input
                      type="text"
                      placeholder="Link Download PDF Buku (e.g. https://...)"
                      required
                      className="px-3 py-2 text-xs rounded-lg glass-input text-powdery-dark-text font-medium col-span-1 md:col-span-3"
                      value={newLibrary.downloadUrl}
                      onChange={(e) => setNewLibrary({ ...newLibrary, downloadUrl: e.target.value })}
                    />
                    <button type="submit" className="w-full bg-powdery-accent-dark text-white rounded-lg text-xs font-bold cursor-pointer py-2">
                      Tambahkan Buku
                    </button>
                  </div>
                </form>
              )}

              {/* Library Cards render */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
                {filteredLibrary.length === 0 ? (
                  <div className="col-span-full p-8 text-center rounded-2xl glass-panel text-gray-400 font-medium text-xs">
                    Tidak ditemukan pustaka/buku yang sesuai dengan kategori.
                  </div>
                ) : (
                  filteredLibrary.map((lib) => (
                    <div key={lib.id} className="p-6 rounded-2xl glass-panel flex flex-col justify-between border border-white/60 hover:shadow-glass-hover transition relative">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[9px] bg-powdery-accent-light text-powdery-accent-dark font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                            {lib.category}
                          </span>
                        </div>
                        <h4 className="font-display font-extrabold text-base text-powdery-dark-text mb-1 leading-snug">
                          {lib.title}
                        </h4>
                        <p className="text-[11px] text-gray-500 font-bold mb-3">
                          Penulis/Dosen: {lib.author}
                        </p>
                        {lib.description && (
                          <p className="text-xs text-gray-600 font-medium leading-relaxed mb-4">
                            {lib.description}
                          </p>
                        )}
                      </div>

                      <a
                        href={lib.downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full bg-white text-powdery-accent-dark border border-powdery-accent-light hover:bg-powdery-accent-light/30 text-center py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-glass-sm"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Unduh Dokumen PDF
                      </a>

                      {isAdminMode && (
                        <button
                          onClick={() => performDelete("library", lib.id)}
                          className="absolute top-4 right-4 p-1 text-red-500 hover:bg-red-50 rounded-lg cursor-pointer"
                          title="Hapus"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* FLOAT ACTIONS FOOTER LOGO & ADMIN LOGO */}
      <footer className="mt-16 text-center text-xs text-gray-400 border-t border-gray-150 py-8 space-y-4 max-w-7xl mx-auto px-4">
        <p className="font-medium font-display text-gray-400">
          © 2026 Study Cove - Portal S1 MPAI. All Right Reserved.
        </p>

        <div className="flex items-center justify-center gap-2" id="admin-onboarding">
          <button
            onClick={() => {
              if (isAdminMode) {
                setIsAdminMode(false);
                dispatchToast("Berhasil Keluar dari Ruang CRUD Admin S1.", "info");
              } else {
                setShowAdminLogin(true);
              }
            }}
            className="flex items-center gap-1 px-4 py-2 bg-white/70 border border-powdery-accent-light rounded-xl hover:bg-white transition text-[11px] font-bold text-powdery-dark-text cursor-pointer"
          >
            {isAdminMode ? (
              <>
                <Unlock className="w-3.5 h-3.5 text-red-500" /> Keluar Mode Admin
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5 text-powdery-accent-dark" /> Masuk Mode Admin S1
              </>
            )}
          </button>
        </div>
      </footer>

      {/* FLOATING CHATBOT ASSISTANT FOR S1 MPAI - GEMINI */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3 font-medium">
        <AnimatePresence>
          {isChatOpen && (
            <motion.div
              initial={{ opacity: 0, y: 15, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 15, scale: 0.95 }}
              className="w-[320px] sm:w-[380px] h-[480px] rounded-2xl glass-panel-solid border border-[#DCE7EB] shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Chat Header */}
              <div className="p-4 bg-powdery-accent-dark text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="font-display font-bold text-sm tracking-tight leading-tight">Asisten AI S1 MPAI</h4>
                    <span className="text-[10px] text-[#C6ECF8] font-medium leading-none">Powered by Gemini AI</span>
                  </div>
                </div>
                <button
                  onClick={() => setIsChatOpen(false)}
                  className="text-[#EBF7FC] hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Chat Logs */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-white/35">
                {chatHistory.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs font-semibold leading-relaxed shadow-glass-sm ${
                        message.role === "user"
                          ? "bg-powdery-accent-dark text-white rounded-tr-none"
                          : "bg-white text-powdery-dark-text border border-gray-100 rounded-tl-none whitespace-pre-wrap"
                      }`}
                    >
                      {message.text}
                    </div>
                  </div>
                ))}
                
                {isGeneratingChat && (
                  <div className="flex justify-start">
                    <div className="bg-white text-powdery-dark-text border border-gray-100 rounded-2xl rounded-tl-none px-4 py-2.5 text-xs font-semibold flex items-center gap-1.5 shadow-glass-sm animate-pulse">
                      <span>Berpikir cerdas...</span>
                      <span className="w-1.5 h-1.5 bg-powdery-accent-dark rounded-full animate-bounce duration-500" />
                      <span className="w-1.5 h-1.5 bg-powdery-accent-dark rounded-full animate-bounce duration-500 [animation-delay:0.2s]" />
                    </div>
                  </div>
                )}
                
                <div ref={chatBottomRef} />
              </div>

              {/* Chat Send Form */}
              <form onSubmit={handleSendGeminiChat} className="p-3 bg-white border-t border-[#E1EEF2] flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Tanyakan materi, kurikulum atau teori..."
                  className="flex-1 bg-[#F4F9FB] rounded-xl px-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-powdery-accent-dark text-powdery-dark-text font-medium"
                  value={chatMessageInput}
                  onChange={(e) => setChatMessageInput(e.target.value)}
                  disabled={isGeneratingChat}
                />
                <button
                  type="submit"
                  disabled={isGeneratingChat || !chatMessageInput.trim()}
                  className="p-2 bg-powdery-accent-dark hover:bg-opacity-95 text-white rounded-xl transition cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Float Activation Indicator */}
        <motion.button
          onClick={() => setIsChatOpen(!isChatOpen)}
          className="w-14 h-14 bg-powdery-accent-dark text-white hover:bg-opacity-90 rounded-full flex items-center justify-center shadow-2xl hover:scale-105 transition active:scale-95 cursor-pointer border border-[#83BAC9]"
          id="floating-gemini-trigger"
        >
          {isChatOpen ? <X className="w-6 h-6" /> : <Bot className="w-6 h-6 animate-pulse" />}
        </motion.button>
      </div>

      {/* ADMIN PASSWORD LOGIN CARD POPUP */}
      <AnimatePresence>
        {showAdminLogin && (
          <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm p-6 rounded-2xl glass-panel-solid text-center"
            >
              <div className="w-12 h-12 bg-powdery-accent-light text-powdery-accent-dark rounded-full flex items-center justify-center mx-auto mb-3 shadow-glass-sm">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="font-display font-extrabold text-base mb-1">Otoritas S1 MPAI Admin</h3>
              <p className="text-[11px] text-gray-500 mb-4 font-semibold">Silakan masukkan kata sandi administrator panitia Prodi.</p>

              <form onSubmit={handleAdminAuthSubmit} className="space-y-3">
                <input
                  type="password"
                  placeholder="KODE SANDI ADMIN"
                  required
                  className="w-full px-4 py-2 text-center text-xs rounded-xl glass-input font-bold tracking-widest text-[#19323B]"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAdminLogin(false)}
                    className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-xs font-semibold rounded-xl cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-powdery-accent-dark hover:bg-opacity-95 text-white text-xs font-semibold rounded-xl cursor-pointer"
                  >
                    Unlock
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ONBOARDING TOUR MODAL OVERLAYS */}
      <AnimatePresence>
        {showTour && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm p-6 rounded-3xl glass-panel-solid shadow-2xl relative"
            >
              <div className="flex items-center gap-2 text-powdery-accent-dark mb-2">
                <Bot className="w-5 h-5 flex-shrink-0 animate-bounce" />
                <span className="text-[10px] font-bold tracking-widest uppercase">panduan asisten</span>
              </div>
              
              <h3 className="font-display font-extrabold text-[#112429] text-base mb-1.5 leading-snug">
                {tourSteps[tourStep].title}
              </h3>
              
              <p className="text-xs text-[#2F4951] leading-relaxed mb-6 font-medium">
                {tourSteps[tourStep].content}
              </p>

              <div className="flex justify-between items-center bg-powdery-accent-light/50 -mx-6 -mb-6 p-4 rounded-b-3xl">
                <div className="flex gap-1.5">
                  {tourSteps.map((_, i) => (
                    <span
                      key={i}
                      className={`w-2 h-2 rounded-full transition-all duration-300 ${
                        i === tourStep ? "bg-powdery-accent-dark w-4" : "bg-gray-300"
                      }`}
                    />
                  ))}
                </div>
                
                <button
                  onClick={handleNextTour}
                  className="px-4 py-1.5 bg-powdery-accent-dark text-white rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-opacity-90 transition cursor-pointer"
                >
                  {tourStep === tourSteps.length - 1 ? "Selesai" : "Mengerti"} <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MULTIPLE TOAST NOTIFICATIONS DRAWER POPUP */}
      <div className="fixed bottom-6 left-6 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: -20, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -20, scale: 0.9 }}
              className="p-4 rounded-xl flex items-center gap-3 shadow-lg glass-panel-solid border-l-4 pointer-events-auto border-powdery-accent-dark"
            >
              {toast.type === "success" && <CheckCircle className="text-emerald-500 w-5 h-5 shrink-0" />}
              {toast.type === "error" && <AlertCircle className="text-red-500 w-5 h-5 shrink-0" />}
              {toast.type === "warning" && <AlertCircle className="text-amber-500 w-5 h-5 shrink-0" />}
              {toast.type === "info" && <Info className="text-powdery-accent-dark w-5 h-5 shrink-0" />}
              
              <div className="text-xs font-semibold text-powdery-dark-text leading-relaxed">
                {toast.text}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
