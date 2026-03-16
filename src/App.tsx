/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, createContext, useContext } from 'react';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  signOut, 
  User,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  getAuth,
  sendPasswordResetEmail,
  deleteUser
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  Timestamp,
  GeoPoint,
  getDocs,
  deleteDoc,
  serverTimestamp,
  limit,
  getDocsFromServer,
  updateDoc
} from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import { auth, db } from './firebase';
import { UserProfile, AttendanceRecord, UserRole, AllowedLocation } from './types';
import { 
  LogOut, 
  MapPin, 
  History, 
  Users, 
  Plus, 
  User as UserIcon, 
  Clock,
  ShieldCheck,
  Search,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Chrome,
  Key,
  UserPlus,
  Trash2,
  RefreshCw,
  FileText,
  FileDown,
  Share2,
  X,
  Download,
  Edit2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MapContainer, TileLayer, Marker, useMapEvents, Circle, useMap } from 'react-leaflet';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import L from 'leaflet';
import firebaseConfig from '../firebase-applet-config.json';

// Fix leaflet default icon issue
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// --- Context ---
interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType>({ user: null, profile: null, loading: true, error: null });

// --- Components ---

const LoadingScreen = () => (
  <div className="min-h-screen flex items-center justify-center bg-teal-50">
    <motion.div 
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
    >
      <Loader2 className="w-10 h-10 text-teal-600" />
    </motion.div>
  </div>
);

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Helper to map username to internal email
  const getInternalEmail = (user: string) => {
    const trimmed = user.trim().toLowerCase();
    if (trimmed.includes('@') && !trimmed.startsWith('@')) return trimmed;
    const clean = trimmed.replace('@', '');
    return `${clean}@cognitivo.ap`;
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      if (result.user.email !== 'alailsondeoliveirapng@gmail.com') {
        await signOut(auth);
        setError('Acesso negado: Apenas a conta principal pode fazer login via Google.');
      }
    } catch (err: any) {
      console.error("Google login error:", err.code);
      setError('Erro ao entrar com Google: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    const email = getInternalEmail(username);
    const isAdminUser = username.toLowerCase() === '@admin' || username.toLowerCase() === 'admin@cognitivo.ap';
    const isMasterUser = username.toLowerCase() === '@adminmaster' || username.toLowerCase() === 'adminmaster@cognitivo.ap';

    try {
      // Try to sign in
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      console.error("Login error code:", err.code);
      
      const isInvalidCred = err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found';

      if ((isAdminUser || isMasterUser) && isInvalidCred) {
        // FIRST PASSWORD LOGIC FOR ADMIN
        // If it's the first login, we check if the password matches the default one
        if (password !== 'admin2559') {
          setError('Senha incorreta para o primeiro acesso do administrador. Use a senha padrão.');
          setLoading(false);
          return;
        }

        try {
          const userCred = await createUserWithEmailAndPassword(auth, email, password);
          await setDoc(doc(db, 'usuarios', userCred.user.uid), {
            uid: userCred.user.uid,
            nome: isAdminUser ? 'Administrador' : 'Master Admin',
            email: email,
            role: 'admin'
          });
          return; 
        } catch (createErr: any) {
          console.error("Create admin error:", createErr.code);
          if (createErr.code === 'auth/email-already-in-use') {
            setError('A conta @admin já existe, mas a SENHA está incorreta. Use a senha que você definiu no primeiro acesso.');
          } else if (createErr.code === 'auth/operation-not-allowed' || createErr.code === 'auth/invalid-credential') {
            setError('ERRO: O login por E-mail/Senha está DESATIVADO no seu Firebase. Você PRECISA ativar no Console (link acima).');
          } else {
            setError('Erro ao criar admin: ' + createErr.message);
          }
        }
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('ERRO: O login por E-mail/Senha está DESATIVADO no seu Firebase. Você PRECISA ativar no Console (link acima).');
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        setError('Usuário ou senha incorretos. (Nota: Se for o primeiro acesso do admin, verifique se ativou o login no Console)');
      } else {
        setError('Erro: ' + err.code + '. Verifique sua conexão e a configuração do Firebase.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-teal-600 relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-teal-500 rounded-full opacity-50 blur-3xl"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-teal-700 rounded-full opacity-50 blur-3xl"></div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-white rounded-[2rem] shadow-2xl p-8 relative z-10"
      >
        <div className="text-center mb-8">
          <div className="flex justify-center items-center mb-2">
            <img src="/logo.png" alt="Logo" className="w-24 h-16 object-contain" referrerPolicy="no-referrer" />
          </div>
          <div className="text-center">
            <p className="text-[10px] font-bold tracking-[0.3em] text-zinc-800 uppercase ml-1">Espaço</p>
            <h1 className="text-3xl font-extrabold text-zinc-900 tracking-tight -mt-1">Cognitivo</h1>
          </div>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm flex items-start gap-3"
          >
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold mb-1">Atenção</p>
              <p>{error}</p>
              {error.includes('Console') && (
                <a 
                  href="https://console.firebase.google.com/project/gen-lang-client-0955396860/authentication/providers" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="mt-2 inline-block font-bold underline decoration-2 underline-offset-2"
                >
                  Clique aqui para ativar agora →
                </a>
              )}
            </div>
          </motion.div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-400 uppercase ml-1 tracking-wider">Usuário</label>
            <div className="relative group bg-zinc-50 border border-zinc-200 rounded-xl focus-within:border-teal-600 focus-within:bg-white focus-within:ring-4 focus-within:ring-teal-50 transition-all">
              <UserPlus className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 group-focus-within:text-teal-600 transition-colors z-10" />
              
              <div className="absolute inset-0 flex items-center pl-12 pr-4 pointer-events-none overflow-hidden">
                <span className="text-sm text-transparent whitespace-pre font-sans">{username}</span>
                {!username.includes('@') && username.length > 0 && (
                  <span className="text-sm text-zinc-400 whitespace-pre font-sans">@cognitivo.ap</span>
                )}
                {username.length === 0 && (
                  <span className="text-sm text-zinc-400 whitespace-pre font-sans">Ex: seu.nome</span>
                )}
              </div>

              <input 
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 bg-transparent outline-none text-sm relative z-20 text-zinc-900 font-sans"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-500 uppercase ml-1 tracking-wider">Senha</label>
            <div className="relative group">
              <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 group-focus-within:text-teal-600 transition-colors" />
              <input 
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:border-teal-600 focus:bg-white focus:ring-4 focus:ring-teal-50 outline-none transition-all text-sm"
                required
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-md shadow-teal-600/20 flex items-center justify-center gap-2 disabled:opacity-70 mt-4"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Acessar'}
          </button>
        </form>

        {(username.toLowerCase() === '@adminmaster' || username.toLowerCase() === 'adminmaster@cognitivo.ap') && (
          <>
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-100"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-4 text-zinc-400 font-bold">Ou use o Google</span>
              </div>
            </div>

            <button 
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full bg-white hover:bg-zinc-50 text-zinc-700 font-bold py-4 rounded-2xl border-2 border-zinc-100 transition-all flex items-center justify-center gap-3"
            >
              <Chrome className="w-5 h-5 text-blue-500" />
              Entrar com Google (Admin)
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
};

const FuncionarioDashboard = () => {
  const { profile, user } = useContext(AuthContext);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [allowedLocations, setAllowedLocations] = useState<AllowedLocation[]>([]);
  const [loadingLocs, setLoadingLocs] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkInProgress, setCheckInProgress] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [lastRecordTimeStr, setLastRecordTimeStr] = useState('');
  const [recordLimit, setRecordLimit] = useState(30);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [showSuccessAnim, setShowSuccessAnim] = useState(false);

  const handleUpdatePassword = async () => {
    if (!newPassword || !user) return;
    setIsUpdatingPassword(true);
    try {
      const { updatePassword } = await import('firebase/auth');
      await updatePassword(user, newPassword);
      setProfileMsg({ type: 'success', text: 'Senha alterada com sucesso!' });
      setNewPassword('');
    } catch (err: any) {
      if (err.code === 'auth/requires-recent-login') {
        setProfileMsg({ type: 'error', text: 'Para sua segurança, saia e entre novamente antes de alterar a senha.' });
      } else {
        setProfileMsg({ type: 'error', text: 'Erro: ' + err.message });
      }
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'pontos'),
      where('userId', '==', user.uid),
      orderBy('timestamp', 'desc'),
      limit(recordLimit)
    );
    return onSnapshot(q, (snapshot) => {
      setRecords(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord)));
    });
  }, [user, recordLimit]);

  const handleSync = async () => {
    if (!user) return;
    setIsSyncing(true);
    try {
      const q = query(
        collection(db, 'pontos'),
        where('userId', '==', user.uid),
        orderBy('timestamp', 'desc'),
        limit(recordLimit)
      );
      // Force fetch from server to update local cache
      await getDocsFromServer(q);
      setStatus({ type: 'success', msg: 'Dados sincronizados com a nuvem!' });
      setTimeout(() => setStatus(null), 3000);
    } catch (error) {
      console.error("Error syncing:", error);
      setStatus({ type: 'error', msg: 'Erro ao sincronizar. Verifique sua conexão.' });
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    const qLoc = query(collection(db, 'locais_permitidos'));
    return onSnapshot(qLoc, (snapshot) => {
      setAllowedLocations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AllowedLocation)));
      setLoadingLocs(false);
    }, (error) => {
      console.error("Error fetching locations:", error);
      setLoadingLocs(false);
    });
  }, []);

  // Haversine formula to calculate distance in meters
  const getDistanceInMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371000; // Earth radius in meters
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const initiateCheckIn = () => {
    if (records.length > 0) {
      const lastRecord = records[0];
      if (lastRecord.timestamp) {
        const lastTimeMs = lastRecord.timestamp.toMillis();
        const nowMs = Date.now();
        const diffMins = (nowMs - lastTimeMs) / (1000 * 60);
        
        if (diffMins < 30) {
          const timeStr = lastRecord.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          setLastRecordTimeStr(timeStr);
          setShowWarningModal(true);
          return;
        }
      }
    }
    executeCheckIn();
  };

  const executeCheckIn = async () => {
    setShowWarningModal(false);
    setCheckingIn(true);
    setStatus(null);
    setCheckInProgress('Solicitando acesso ao GPS...');
    
    if (!navigator.geolocation) {
      setStatus({ type: 'error', msg: 'Geolocalização não suportada.' });
      setCheckingIn(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        setCheckInProgress('Analisando sua posição atual...');
        const { latitude, longitude } = position.coords;
        
        // Check geofencing
        if (allowedLocations.length === 0) {
          setStatus({ type: 'error', msg: 'Nenhum local permitido configurado pelo administrador.' });
          setCheckingIn(false);
          return;
        }

        let isWithinAnyLocation = false;
        let minDistance = Infinity;
        let nearestLocName = '';

        for (const loc of allowedLocations) {
          const distance = getDistanceInMeters(latitude, longitude, loc.latitude, loc.longitude);
          if (distance <= loc.raio) {
            isWithinAnyLocation = true;
            break;
          }
          if (distance < minDistance) {
            minDistance = distance;
            nearestLocName = loc.nome;
          }
        }
        
        if (!isWithinAnyLocation) {
          const distKm = (minDistance / 1000).toFixed(2);
          setStatus({ 
            type: 'error', 
            msg: `Você está fora da área permitida. O local mais próximo (${nearestLocName}) está a ${distKm}km de distância.` 
          });
          setCheckingIn(false);
          return;
        }

        // Reverse geocoding (Nominatim)
        setCheckInProgress('Identificando endereço aproximado...');
        let endereco = 'Localização desconhecida';
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          const data = await res.json();
          endereco = data.display_name || endereco;
        } catch (e) {
          console.error('Geocoding error', e);
        }

        setCheckInProgress('Salvando registro de ponto...');
        await addDoc(collection(db, 'pontos'), {
          userId: user?.uid,
          userName: profile?.nome,
          timestamp: serverTimestamp(),
          localizacao: new GeoPoint(latitude, longitude),
          endereco
        });

        setStatus({ type: 'success', msg: 'Ponto batido com sucesso!' });
        setShowSuccessAnim(true);
        setTimeout(() => setShowSuccessAnim(false), 3000);
      } catch (err) {
        setStatus({ type: 'error', msg: 'Erro ao salvar ponto.' });
      } finally {
        setCheckingIn(false);
        setCheckInProgress('');
      }
    }, (err) => {
      setStatus({ type: 'error', msg: 'Permissão de localização negada.' });
      setCheckingIn(false);
      setCheckInProgress('');
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 });
  };

  return (
    <div className="max-w-2xl mx-auto p-4 pb-24">
      <header className="flex justify-between items-center mb-8 pt-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-teal-600 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-sm">
            {profile?.nome?.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-zinc-900 leading-tight">Olá, {profile?.nome?.split(' ')[0]}</h2>
            <p className="text-teal-600 font-medium text-sm">Espaço Cognitivo</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowProfileModal(true)} className="p-3 rounded-2xl bg-white border border-zinc-200 text-zinc-600 hover:bg-teal-50 hover:text-teal-600 hover:border-teal-100 transition-all shadow-sm">
            <UserIcon className="w-5 h-5" />
          </button>
          <button onClick={() => signOut(auth)} className="p-3 rounded-2xl bg-white border border-zinc-200 text-zinc-600 hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-all shadow-sm">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <motion.div 
        className="bg-white rounded-[2rem] shadow-xl shadow-zinc-200/40 p-8 mb-8 border border-zinc-100 flex flex-col items-center text-center relative overflow-hidden"
        whileHover={{ scale: 1.01 }}
      >
        {/* Decorative background in card */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-teal-50 rounded-bl-[100px] -z-0 opacity-50"></div>
        
        <div className="mb-6 relative z-10">
          <div className="w-32 h-32 rounded-full bg-teal-50 flex items-center justify-center relative shadow-inner">
            <motion.div 
              className="absolute inset-0 rounded-full border-4 border-teal-100 border-t-teal-600"
              style={{ willChange: 'transform' }}
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
            />
            <MapPin className="w-12 h-12 text-teal-600" />
          </div>
        </div>
        
        <h3 className="text-2xl font-bold text-zinc-900 mb-2 relative z-10">Registrar Ponto</h3>
        <p className="text-zinc-500 text-sm mb-8 max-w-xs relative z-10">Sua localização será capturada automaticamente para validar o registro.</p>

        <button 
          onClick={initiateCheckIn}
          disabled={checkingIn || loadingLocs}
          className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-teal-600/20 flex items-center justify-center gap-2 disabled:opacity-70 relative z-10 text-lg"
        >
          {checkingIn || loadingLocs ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Bater Ponto Agora'}
        </button>

        {checkingIn && checkInProgress && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-4 w-full bg-zinc-50 rounded-xl p-4 border border-zinc-100 flex items-center gap-3 text-left relative z-10"
          >
            <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
              <Loader2 className="w-4 h-4 text-teal-600 animate-spin" />
            </div>
            <div>
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-0.5">Processando</p>
              <p className="text-sm font-medium text-zinc-700">{checkInProgress}</p>
            </div>
          </motion.div>
        )}

        {status && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mt-6 flex items-center justify-center gap-2 text-sm p-4 rounded-xl w-full relative z-10 font-medium ${status.type === 'success' ? 'bg-teal-50 text-teal-700 border border-teal-100' : 'bg-red-50 text-red-700 border border-red-100'}`}
          >
            {status.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span>{status.msg}</span>
          </motion.div>
        )}
      </motion.div>

      {/* 30-min Warning Modal */}
      <AnimatePresence>
        {showWarningModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-zinc-100"
            >
              <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 mx-auto mb-6 border border-amber-100">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 text-center mb-2">Atenção</h3>
              <p className="text-zinc-500 text-center mb-8 text-sm">
                Você pretende bater o ponto novamente? Seu último batimento foi às <strong>{lastRecordTimeStr}</strong>.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowWarningModal(false)}
                  className="flex-1 py-3 rounded-xl font-bold text-zinc-500 hover:bg-zinc-100 transition-all active:scale-[0.98]"
                >
                  Cancelar
                </button>
                <button 
                  onClick={executeCheckIn}
                  className="flex-1 py-3 rounded-xl font-bold bg-amber-500 text-white hover:bg-amber-600 transition-all shadow-lg shadow-amber-500/20 active:scale-[0.98]"
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <section>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-teal-600" />
            <h3 className="text-lg font-bold text-zinc-900">Seu Histórico</h3>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleSync}
              disabled={isSyncing}
              className="flex items-center gap-1.5 text-xs font-bold bg-teal-50 text-teal-700 px-3 py-1.5 rounded-full hover:bg-teal-100 transition-all disabled:opacity-50"
              title="Sincronizar com a nuvem"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Sincronizando...' : 'Sincronizar'}
            </button>
            <span className="text-xs font-semibold bg-zinc-100 text-zinc-500 px-3 py-1.5 rounded-full">Últimos {records.length}</span>
          </div>
        </div>
        
        <div className="space-y-3">
          {records.length === 0 ? (
            <div className="text-center py-12 bg-zinc-50 rounded-3xl border border-dashed border-zinc-200">
              <p className="text-zinc-400 text-sm">Nenhum registro encontrado.</p>
            </div>
          ) : (
            <>
              {records.map((record) => (
                <motion.div 
                  key={record.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-white p-5 rounded-2xl border border-zinc-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-all"
                >
                  <div className="w-14 h-14 bg-teal-50 rounded-2xl flex items-center justify-center flex-shrink-0 border border-teal-100">
                    <Clock className="w-6 h-6 text-teal-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <p className="font-bold text-zinc-900 text-lg">
                        {record.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <p className="text-xs font-medium text-zinc-400 bg-zinc-50 px-2 py-1 rounded-md">
                        {record.timestamp?.toDate().toLocaleDateString()}
                      </p>
                    </div>
                    <p className="text-xs text-zinc-500 truncate flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-teal-500" />
                      {record.endereco}
                    </p>
                  </div>
                </motion.div>
              ))}
              
              {records.length >= recordLimit && (
                <button 
                  onClick={() => setRecordLimit(prev => prev + 30)}
                  className="w-full py-4 mt-2 rounded-2xl border-2 border-dashed border-zinc-200 text-zinc-500 font-bold hover:bg-zinc-50 hover:text-teal-600 hover:border-teal-200 transition-all"
                >
                  Carregar Mais Registros
                </button>
              )}
            </>
          )}
        </div>
      </section>

      {/* Profile Modal */}
      <AnimatePresence>
        {showProfileModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-zinc-100 relative"
            >
              <button 
                onClick={() => setShowProfileModal(false)}
                className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="w-16 h-16 bg-teal-50 rounded-2xl flex items-center justify-center text-teal-600 mx-auto mb-6 border border-teal-100">
                <UserIcon className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 text-center mb-2">Seu Perfil</h3>
              <p className="text-zinc-500 text-center mb-6 text-sm">
                {profile?.email}
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1 ml-1">Nova Senha</label>
                  <input 
                    type="password"
                    placeholder="Digite a nova senha"
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-teal-500 outline-none text-sm bg-zinc-50 focus:bg-white transition-all"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                  />
                </div>

                {profileMsg && (
                  <div className={`flex items-center gap-2 text-sm p-3 rounded-xl ${profileMsg.type === 'success' ? 'bg-teal-50 text-teal-700 border border-teal-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                    {profileMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    <span>{profileMsg.text}</span>
                  </div>
                )}

                <button 
                  onClick={handleUpdatePassword}
                  disabled={isUpdatingPassword || !newPassword}
                  className="w-full py-3.5 rounded-xl bg-teal-600 text-white font-bold hover:bg-teal-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-teal-600/20 active:scale-[0.98]"
                >
                  {isUpdatingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                  Atualizar Senha
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Success Animation Modal */}
      <AnimatePresence>
        {showSuccessAnim && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-teal-600/90 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: "spring", bounce: 0.5 }}
              className="bg-white p-10 rounded-[3rem] flex flex-col items-center justify-center shadow-2xl border-4 border-teal-400"
            >
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.2, type: "spring", bounce: 0.6 }}
                className="w-24 h-24 bg-teal-50 rounded-full flex items-center justify-center mb-4"
              >
                <CheckCircle2 className="w-16 h-16 text-teal-500" />
              </motion.div>
              <motion.p 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-3xl font-extrabold text-zinc-900 tracking-tight"
              >
                Ponto Registrado!
              </motion.p>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="text-teal-600 font-medium mt-2"
              >
                Tenha um ótimo dia de trabalho.
              </motion.p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const LocationPickerMap = ({ lat, lng, radius, onLocationSelect }: { lat: string, lng: string, radius: string, onLocationSelect: (lat: string, lng: string) => void }) => {
  const defaultCenter: [number, number] = [-23.5505, -46.6333]; // Sao Paulo default
  const center: [number, number] = lat && lng && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng)) 
    ? [parseFloat(lat), parseFloat(lng)] 
    : defaultCenter;

  const MapEvents = () => {
    useMapEvents({
      click(e) {
        onLocationSelect(e.latlng.lat.toFixed(6), e.latlng.lng.toFixed(6));
      },
    });
    return null;
  };

  const MapUpdater = ({ center }: { center: [number, number] }) => {
    const map = useMap();
    useEffect(() => {
      map.setView(center, map.getZoom());
    }, [center, map]);
    return null;
  };

  return (
    <div className="w-full h-[250px] rounded-xl overflow-hidden border border-zinc-200 relative z-0 mb-4">
      <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        {lat && lng && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng)) && (
          <>
            <Marker position={[parseFloat(lat), parseFloat(lng)]} />
            {!isNaN(parseFloat(radius)) && (
              <Circle 
                center={[parseFloat(lat), parseFloat(lng)]} 
                radius={parseFloat(radius)} 
                pathOptions={{ color: '#0d9488', fillColor: '#14b8a6', fillOpacity: 0.2 }} 
              />
            )}
          </>
        )}
        <MapEvents />
        <MapUpdater center={center} />
      </MapContainer>
    </div>
  );
};

const AdminDashboard = () => {
  const { profile, user } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState<'users' | 'history' | 'profile' | 'locations'>('history');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [employees, setEmployees] = useState<UserProfile[]>([]);
  const [allRecords, setAllRecords] = useState<AttendanceRecord[]>([]);
  const [search, setSearch] = useState('');
  const [selectedMapRecord, setSelectedMapRecord] = useState<AttendanceRecord | null>(null);
  
  // New employee state
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [msg, setMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Locations state
  const [locations, setLocations] = useState<AllowedLocation[]>([]);
  const [newLocName, setNewLocName] = useState('');
  const [newLocLat, setNewLocLat] = useState('');
  const [newLocLng, setNewLocLng] = useState('');
  const [newLocRadius, setNewLocRadius] = useState('100');
  const [isCreatingLoc, setIsCreatingLoc] = useState(false);
  const [locMsg, setLocMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [editingLocId, setEditingLocId] = useState<string | null>(null);
  const [recordLimit, setRecordLimit] = useState(50);
  const [isSyncing, setIsSyncing] = useState(false);

  // Quick Reset state
  const [quickResetUser, setQuickResetUser] = useState<UserProfile | null>(null);
  const [quickResetPassword, setQuickResetPassword] = useState('');
  const [isQuickResetting, setIsQuickResetting] = useState(false);

  // Export state
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportStartDate, setExportStartDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  });
  const [exportEndDate, setExportEndDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
  });
  const [exportSelectedUsers, setExportSelectedUsers] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (activeTab === 'locations' && !newLocLat && !newLocLng) {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition((position) => {
          setNewLocLat(position.coords.latitude.toFixed(6));
          setNewLocLng(position.coords.longitude.toFixed(6));
        }, (error) => {
          console.error("Error getting location:", error);
        });
      }
    }
  }, [activeTab, newLocLat, newLocLng]);

  useEffect(() => {
    const qUsers = query(collection(db, 'usuarios'), where('role', '==', 'funcionario'));
    const unsubUsers = onSnapshot(qUsers, (snap) => {
      setEmployees(snap.docs.map(d => d.data() as UserProfile));
    });

    const qRecords = query(collection(db, 'pontos'), orderBy('timestamp', 'desc'), limit(recordLimit));
    const unsubRecords = onSnapshot(qRecords, (snap) => {
      setAllRecords(snap.docs.map(d => ({ id: d.id, ...d.data() } as AttendanceRecord)));
    });

    const qLocs = query(collection(db, 'locais_permitidos'));
    const unsubLocs = onSnapshot(qLocs, (snap) => {
      setLocations(snap.docs.map(d => ({ id: d.id, ...d.data() } as AllowedLocation)));
    });

    return () => { unsubUsers(); unsubRecords(); unsubLocs(); };
  }, [recordLimit]);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const qRecords = query(collection(db, 'pontos'), orderBy('timestamp', 'desc'), limit(recordLimit));
      await getDocsFromServer(qRecords);
    } catch (error) {
      console.error("Error syncing:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExport = async (format: 'pdf' | 'text') => {
    setIsExporting(true);
    try {
      const start = new Date(exportStartDate + 'T00:00:00');
      const end = new Date(exportEndDate + 'T23:59:59');
      
      const q = query(
        collection(db, 'pontos'),
        where('timestamp', '>=', Timestamp.fromDate(start)),
        where('timestamp', '<=', Timestamp.fromDate(end)),
        orderBy('timestamp', 'asc')
      );
      
      const snap = await getDocs(q);
      let records = snap.docs.map(d => ({ id: d.id, ...d.data() } as AttendanceRecord));
      
      if (exportSelectedUsers.length > 0) {
        records = records.filter(r => exportSelectedUsers.includes(r.userId));
      }
      
      const grouped: Record<string, AttendanceRecord[]> = {};
      records.forEach(r => {
        if (!grouped[r.userId]) grouped[r.userId] = [];
        grouped[r.userId].push(r);
      });
      
      if (Object.keys(grouped).length === 0) {
        setMsg({ type: 'error', text: 'Nenhum registro encontrado neste período.' });
        setIsExporting(false);
        return;
      }

      if (format === 'pdf') {
        const doc = new jsPDF();
        let isFirstPage = true;

        // Try to load logo
        let logoData: HTMLImageElement | null = null;
        try {
          logoData = await new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = '/logo.png';
          });
        } catch (e) {
          console.error("Logo load error", e);
        }
        
        for (const [userId, userRecords] of Object.entries(grouped)) {
          if (!isFirstPage) {
            doc.addPage();
          }
          isFirstPage = false;
          
          const userName = userRecords[0].userName || 'Funcionário';
          
          // Logo
          if (logoData) {
            doc.addImage(logoData, 'PNG', 14, 10, 30, 30);
          }

          // Header
          doc.setFontSize(18);
          doc.setTextColor(13, 148, 136); // Teal 600
          doc.text('FOLHA DE PONTO', logoData ? 50 : 14, 22);
          
          doc.setFontSize(12);
          doc.setTextColor(0, 0, 0);
          doc.text(`Empresa: Espaço Cognitivo`, logoData ? 50 : 14, 32);
          doc.text(`Funcionário: ${userName}`, logoData ? 50 : 14, 40);
          doc.text(`Período: ${start.toLocaleDateString()} a ${end.toLocaleDateString()}`, logoData ? 50 : 14, 48);
          
          // Table
          const tableData = userRecords.map(r => {
            const date = r.timestamp?.toDate();
            return [
              date ? date.toLocaleDateString() : '-',
              date ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
              'Verificado pelo funcionário'
            ];
          });
          
          autoTable(doc, {
            startY: logoData ? 60 : 55,
            head: [['Data', 'Horário', 'Status']],
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: [13, 148, 136] },
          });
          
          // Footer Signature
          const finalY = (doc as any).lastAutoTable.finalY || 55;
          doc.setFontSize(10);
          doc.text('Reconheço a exatidão dos horários registrados acima.', 14, finalY + 20);
          doc.text('___________________________________________________', 14, finalY + 35);
          doc.text(`Assinatura Eletrônica - ${userName}`, 14, finalY + 42);
        }
        
        doc.save(`Folha_de_Ponto_${exportStartDate}_a_${exportEndDate}.pdf`);
        
      } else if (format === 'text') {
        let text = `*Folha de Ponto*\nEmpresa: Espaço Cognitivo\nPeríodo: ${start.toLocaleDateString()} a ${end.toLocaleDateString()}\n\n`;
        
        for (const [userId, userRecords] of Object.entries(grouped)) {
          const userName = userRecords[0].userName || 'Funcionário';
          text += `*Funcionário: ${userName}*\n`;
          
          userRecords.forEach(r => {
            const date = r.timestamp?.toDate();
            if (date) {
              text += `- ${date.toLocaleDateString()} às ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ✅ Verificado\n`;
            }
          });
          text += '\n';
        }
        
        if (navigator.share) {
          try {
            await navigator.share({
              title: 'Folha de Ponto',
              text: text
            });
          } catch (err) {
            console.error('Error sharing:', err);
            navigator.clipboard.writeText(text);
            setMsg({ type: 'success', text: 'Copiado para a área de transferência!' });
          }
        } else {
          navigator.clipboard.writeText(text);
          setMsg({ type: 'success', text: 'Copiado para a área de transferência!' });
        }
      }
      
      setShowExportModal(false);
    } catch (error) {
      console.error("Error exporting:", error);
      setMsg({ type: 'error', text: 'Erro ao exportar dados.' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setMsg(null);
    
    try {
      // Use a secondary app instance to create user without logging out current admin
      const secondaryAppName = `Secondary-${Date.now()}`;
      const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
      const secondaryAuth = getAuth(secondaryApp);
      
      let email = newEmail.trim().toLowerCase();
      if (!email.includes('@')) {
        email = `${email}@cognitivo.ap`;
      }
      
      const userCred = await createUserWithEmailAndPassword(secondaryAuth, email, newPassword);
      const uid = userCred.user.uid;
      
      await setDoc(doc(db, 'usuarios', uid), {
        uid,
        nome: newName,
        email: email,
        role: 'funcionario'
      });

      setMsg({ type: 'success', text: 'Funcionário cadastrado com sucesso!' });
      setNewEmail(''); setNewPassword(''); setNewName('');
      
      // Cleanup secondary app
      await secondaryAuth.signOut();
    } catch (err: any) {
      console.error("Create error:", err);
      setMsg({ type: 'error', text: 'Erro ao cadastrar: ' + (err.code || err.message) });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteEmployee = async () => {
    if (!userToDelete) return;
    
    try {
      await deleteDoc(doc(db, 'usuarios', userToDelete.uid));
      setMsg({ type: 'success', text: 'Funcionário removido do banco de dados.' });
      setUserToDelete(null);
    } catch (err: any) {
      setMsg({ type: 'error', text: 'Erro ao excluir: ' + err.message });
    }
  };

  const handleResetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
      setMsg({ type: 'success', text: 'E-mail de redefinição enviado para ' + email });
    } catch (err: any) {
      setMsg({ type: 'error', text: 'Erro ao enviar e-mail: ' + err.message });
    }
  };

  const handleUpdateMyPassword = async () => {
    if (!newAdminPassword || !user) return;
    setIsUpdatingPassword(true);
    try {
      // In a real app, we might need to re-authenticate
      // For this specific use case, we'll try direct update
      const { updatePassword } = await import('firebase/auth');
      await updatePassword(user, newAdminPassword);
      setMsg({ type: 'success', text: 'Sua senha foi alterada com sucesso!' });
      setNewAdminPassword('');
    } catch (err: any) {
      console.error("Update password error:", err);
      if (err.code === 'auth/requires-recent-login') {
        setMsg({ type: 'error', text: 'Para sua segurança, saia e entre novamente antes de alterar a senha.' });
      } else {
        setMsg({ type: 'error', text: 'Erro ao alterar senha: ' + err.message });
      }
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingLoc(true);
    setLocMsg(null);
    try {
      if (editingLocId) {
        await updateDoc(doc(db, 'locais_permitidos', editingLocId), {
          nome: newLocName,
          latitude: parseFloat(newLocLat),
          longitude: parseFloat(newLocLng),
          raio: parseInt(newLocRadius)
        });
        setLocMsg({ type: 'success', text: 'Local atualizado com sucesso!' });
        setEditingLocId(null);
      } else {
        await addDoc(collection(db, 'locais_permitidos'), {
          nome: newLocName,
          latitude: parseFloat(newLocLat),
          longitude: parseFloat(newLocLng),
          raio: parseInt(newLocRadius)
        });
        setLocMsg({ type: 'success', text: 'Local cadastrado com sucesso!' });
      }
      setNewLocName(''); setNewLocLat(''); setNewLocLng(''); setNewLocRadius('100');
    } catch (err: any) {
      setLocMsg({ type: 'error', text: 'Erro ao salvar local: ' + err.message });
    } finally {
      setIsCreatingLoc(false);
    }
  };

  const handleEditLocation = (loc: AllowedLocation) => {
    setEditingLocId(loc.id!);
    setNewLocName(loc.nome);
    setNewLocLat(loc.latitude.toString());
    setNewLocLng(loc.longitude.toString());
    setNewLocRadius(loc.raio.toString());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEditLocation = () => {
    setEditingLocId(null);
    setNewLocName(''); setNewLocLat(''); setNewLocLng(''); setNewLocRadius('100');
    setLocMsg(null);
  };

  const handleQuickResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsQuickResetting(true);
    
    // Simulate API call and show error message
    setTimeout(() => {
      setIsQuickResetting(false);
      setMsg({ type: 'error', text: 'A redefinição direta de senha requer configuração do Firebase Admin SDK no servidor. Por favor, use o envio de e-mail.' });
      setQuickResetUser(null);
      setQuickResetPassword('');
    }, 1000);
  };

  const handleDeleteLocation = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'locais_permitidos', id));
    } catch (err: any) {
      console.error("Error deleting location", err);
    }
  };

  const filteredRecords = allRecords.filter(r => 
    r.userName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto p-4 pb-24">
      <header className="flex justify-between items-center mb-8 pt-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900">Painel Admin</h2>
          <p className="text-teal-600 font-medium text-sm">Espaço Cognitivo</p>
        </div>
        <button onClick={() => signOut(auth)} className="p-3 rounded-2xl bg-white border border-zinc-200 text-zinc-600 hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-all shadow-sm">
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      <nav className="flex gap-2 mb-8 bg-zinc-100 p-1.5 rounded-2xl">
        <button 
          onClick={() => setActiveTab('history')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold transition-all ${activeTab === 'history' ? 'bg-white shadow-sm text-teal-600' : 'text-zinc-500 hover:text-zinc-700'}`}
        >
          <History className="w-4 h-4" />
          Histórico
        </button>
        <button 
          onClick={() => setActiveTab('users')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold transition-all ${activeTab === 'users' ? 'bg-white shadow-sm text-teal-600' : 'text-zinc-500 hover:text-zinc-700'}`}
        >
          <Users className="w-4 h-4" />
          Equipe
        </button>
        <button 
          onClick={() => setActiveTab('locations')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold transition-all ${activeTab === 'locations' ? 'bg-white shadow-sm text-teal-600' : 'text-zinc-500 hover:text-zinc-700'}`}
        >
          <MapPin className="w-4 h-4" />
          Locais
        </button>
        <button 
          onClick={() => setActiveTab('profile')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold transition-all ${activeTab === 'profile' ? 'bg-white shadow-sm text-teal-600' : 'text-zinc-500 hover:text-zinc-700'}`}
        >
          <UserIcon className="w-4 h-4" />
          Perfil
        </button>
      </nav>

      <AnimatePresence mode="wait">
        {activeTab === 'history' && (
          <motion.div 
            key="history"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                <input 
                  type="text"
                  placeholder="Filtrar por nome do funcionário..."
                  className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-zinc-200 focus:ring-2 focus:ring-teal-500 outline-none transition-all bg-white shadow-sm"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <button 
                onClick={handleSync}
                disabled={isSyncing}
                className="flex items-center justify-center gap-2 px-6 py-3.5 bg-white border border-zinc-200 text-zinc-700 font-bold rounded-2xl hover:bg-zinc-50 hover:text-teal-600 hover:border-teal-200 transition-all shadow-sm disabled:opacity-50"
              >
                <RefreshCw className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Sincronizando...' : 'Sincronizar Nuvem'}
              </button>
              <button 
                onClick={() => setShowExportModal(true)}
                className="flex items-center justify-center gap-2 px-6 py-3.5 bg-zinc-900 text-white font-bold rounded-2xl hover:bg-zinc-800 transition-all shadow-sm"
              >
                <FileDown className="w-5 h-5" />
                Exportar
              </button>
            </div>

            <div className="bg-white rounded-3xl border border-zinc-100 shadow-xl shadow-zinc-200/40 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-zinc-50 border-b border-zinc-100">
                    <tr>
                      <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Funcionário</th>
                      <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Data/Hora</th>
                      <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Localização</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50">
                    {filteredRecords.map((record) => (
                      <tr key={record.id} className="hover:bg-zinc-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center text-teal-700 font-bold text-sm border border-teal-100">
                              {record.userName?.charAt(0)}
                            </div>
                            <span className="font-bold text-zinc-900">{record.userName}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm">
                            <p className="font-medium text-zinc-900">{record.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                            <p className="text-zinc-400 text-xs">{record.timestamp?.toDate().toLocaleDateString()}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <p className="text-xs text-zinc-500 max-w-[200px] truncate" title={record.endereco}>
                              {record.endereco}
                            </p>
                            {record.localizacao && (
                              <button 
                                onClick={() => setSelectedMapRecord(record)}
                                className="p-1.5 bg-teal-50 text-teal-600 rounded-lg hover:bg-teal-100 transition-colors"
                                title="Ver no mapa"
                              >
                                <MapPin className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredRecords.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-6 py-12 text-center text-zinc-400 text-sm">Nenhum registro encontrado.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              {filteredRecords.length >= recordLimit && !search && (
                <div className="p-4 border-t border-zinc-100 bg-zinc-50/50">
                  <button 
                    onClick={() => setRecordLimit(prev => prev + 50)}
                    className="w-full py-4 rounded-2xl border-2 border-dashed border-zinc-200 text-zinc-500 font-bold hover:bg-white hover:text-teal-600 hover:border-teal-200 transition-all"
                  >
                    Carregar Mais Registros
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'users' && (
          <motion.div 
            key="users"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid md:grid-cols-2 gap-8"
          >
            <div className="bg-white p-8 rounded-3xl border border-zinc-100 shadow-xl shadow-zinc-200/40">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-teal-50 rounded-xl border border-teal-100">
                  <Plus className="w-5 h-5 text-teal-600" />
                </div>
                <h3 className="text-xl font-bold text-zinc-900">Novo Funcionário</h3>
              </div>

              <form onSubmit={handleCreateEmployee} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1 ml-1">Nome Completo</label>
                  <input 
                    type="text" required
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-teal-500 outline-none bg-zinc-50 focus:bg-white transition-all"
                    value={newName} onChange={e => setNewName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1 ml-1">E-mail</label>
                  <div className="relative group bg-zinc-50 border border-zinc-200 rounded-xl focus-within:border-teal-600 focus-within:bg-white focus-within:ring-4 focus-within:ring-teal-50 transition-all">
                    <div className="absolute inset-0 flex items-center px-4 pointer-events-none overflow-hidden">
                      <span className="text-base text-transparent whitespace-pre font-sans">{newEmail}</span>
                      {!newEmail.includes('@') && newEmail.length > 0 && (
                        <span className="text-base text-zinc-400 whitespace-pre font-sans">@cognitivo.ap</span>
                      )}
                      {newEmail.length === 0 && (
                        <span className="text-base text-zinc-400 whitespace-pre font-sans">usuario ou email completo</span>
                      )}
                    </div>
                    <input 
                      type="text" required
                      className="w-full px-4 py-3 bg-transparent outline-none relative z-20 text-zinc-900 font-sans text-base"
                      value={newEmail} 
                      onChange={e => setNewEmail(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1 ml-1">Senha Inicial</label>
                  <input 
                    type="password" required
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-teal-500 outline-none bg-zinc-50 focus:bg-white transition-all"
                    value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  />
                </div>

                {msg && (
                  <div className={`flex items-center gap-2 text-sm p-3 rounded-xl ${msg.type === 'success' ? 'bg-teal-50 text-teal-700 border border-teal-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                    {msg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    <span>{msg.text}</span>
                  </div>
                )}

                <button 
                  type="submit" disabled={isCreating}
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-teal-600/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                >
                  {isCreating ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Cadastrar Funcionário'}
                </button>
              </form>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-zinc-100 shadow-xl shadow-zinc-200/40">
              <h3 className="text-xl font-bold text-zinc-900 mb-6 flex items-center gap-2">
                <Users className="w-5 h-5 text-teal-600" />
                Equipe Cadastrada
              </h3>
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                {employees.length === 0 ? (
                  <p className="text-center text-zinc-400 py-8">Nenhum funcionário cadastrado.</p>
                ) : (
                  employees.map(emp => (
                    <div key={emp.uid} className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                            <UserIcon className="w-5 h-5 text-zinc-400" />
                          </div>
                          <div>
                            <p className="font-bold text-zinc-900 text-sm">{emp.nome}</p>
                            <p className="text-zinc-500 text-xs">{emp.email}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => setUserToDelete(emp)}
                          className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="Excluir Funcionário"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleResetPassword(emp.email)}
                          className="flex-1 text-[10px] font-bold uppercase tracking-wider py-2 rounded-lg bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-100 transition-all flex items-center justify-center gap-1"
                          title="Enviar e-mail de redefinição"
                        >
                          <Key className="w-3 h-3" />
                          Por E-mail
                        </button>
                        <button 
                          onClick={() => setQuickResetUser(emp)}
                          className="flex-1 text-[10px] font-bold uppercase tracking-wider py-2 rounded-lg bg-teal-50 border border-teal-100 text-teal-700 hover:bg-teal-100 transition-all flex items-center justify-center gap-1"
                          title="Redefinir senha rapidamente"
                        >
                          <Key className="w-3 h-3" />
                          Nova Senha
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'locations' && (
          <motion.div 
            key="locations"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid md:grid-cols-2 gap-8"
          >
            <div className="bg-white p-8 rounded-3xl border border-zinc-100 shadow-xl shadow-zinc-200/40">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-teal-50 rounded-xl border border-teal-100">
                  <MapPin className="w-5 h-5 text-teal-600" />
                </div>
                <h3 className="text-xl font-bold text-zinc-900">
                  {editingLocId ? 'Editar Local Permitido' : 'Novo Local Permitido'}
                </h3>
              </div>

              <form onSubmit={handleCreateLocation} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1 ml-1">Nome do Local</label>
                  <input 
                    type="text" required placeholder="Ex: Sede Principal"
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-teal-500 outline-none bg-zinc-50 focus:bg-white transition-all"
                    value={newLocName} onChange={e => setNewLocName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase mb-2 ml-1">Selecione no Mapa ou Digite</label>
                  <LocationPickerMap 
                    lat={newLocLat} 
                    lng={newLocLng} 
                    radius={newLocRadius}
                    onLocationSelect={(lat, lng) => {
                      setNewLocLat(lat);
                      setNewLocLng(lng);
                    }} 
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1 ml-1">Latitude</label>
                    <input 
                      type="number" step="any" required placeholder="-23.5505"
                      className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-teal-500 outline-none bg-zinc-50 focus:bg-white transition-all"
                      value={newLocLat} onChange={e => setNewLocLat(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1 ml-1">Longitude</label>
                    <input 
                      type="number" step="any" required placeholder="-46.6333"
                      className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-teal-500 outline-none bg-zinc-50 focus:bg-white transition-all"
                      value={newLocLng} onChange={e => setNewLocLng(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1 ml-1 flex justify-between">
                    <span>Raio Permitido (metros)</span>
                    <span className="text-teal-600 font-bold">{newLocRadius}m</span>
                  </label>
                  <div className="flex items-center gap-4">
                    <input 
                      type="range" min="10" max="5000" step="10"
                      className="flex-1 h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-teal-600"
                      value={newLocRadius} onChange={e => setNewLocRadius(e.target.value)}
                    />
                    <input 
                      type="number" required min="10"
                      className="w-24 px-3 py-2 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-teal-500 outline-none bg-zinc-50 focus:bg-white transition-all text-center"
                      value={newLocRadius} onChange={e => setNewLocRadius(e.target.value)}
                    />
                  </div>
                </div>

                {locMsg && (
                  <div className={`flex items-center gap-2 text-sm p-3 rounded-xl ${locMsg.type === 'success' ? 'bg-teal-50 text-teal-700 border border-teal-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                    {locMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    <span>{locMsg.text}</span>
                  </div>
                )}

                <div className="flex gap-3">
                  {editingLocId && (
                    <button 
                      type="button" 
                      onClick={cancelEditLocation}
                      className="flex-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 font-bold py-3.5 rounded-xl transition-all"
                    >
                      Cancelar
                    </button>
                  )}
                  <button 
                    type="submit" disabled={isCreatingLoc}
                    className="flex-[2] bg-teal-600 hover:bg-teal-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-teal-600/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                  >
                    {isCreatingLoc ? <Loader2 className="w-5 h-5 animate-spin" /> : (editingLocId ? 'Salvar Alterações' : 'Cadastrar Local')}
                  </button>
                </div>
              </form>
            </div>

            <div className="bg-white p-8 rounded-3xl border border-zinc-100 shadow-xl shadow-zinc-200/40">
              <h3 className="text-xl font-bold text-zinc-900 mb-6 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-teal-600" />
                Locais Cadastrados
              </h3>
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                {locations.length === 0 ? (
                  <p className="text-center text-zinc-400 py-8">Nenhum local cadastrado. <strong>Atenção:</strong> Sem locais configurados, os funcionários não conseguirão bater ponto.</p>
                ) : (
                  locations.map(loc => (
                    <div key={loc.id} className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                            <MapPin className="w-5 h-5 text-zinc-400" />
                          </div>
                          <div>
                            <p className="font-bold text-zinc-900 text-sm">{loc.nome}</p>
                            <p className="text-zinc-500 text-xs">Raio: {loc.raio}m</p>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button 
                            onClick={() => handleEditLocation(loc)}
                            className="p-2 text-zinc-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-all"
                            title="Editar Local"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => loc.id && handleDeleteLocation(loc.id)}
                            className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="Excluir Local"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="flex gap-2 text-xs text-zinc-500 bg-white p-2 rounded-lg border border-zinc-100">
                        <span>Lat: {loc.latitude}</span>
                        <span>|</span>
                        <span>Lng: {loc.longitude}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'profile' && (
          <motion.div 
            key="profile"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="max-w-md mx-auto"
          >
            <div className="bg-white p-8 rounded-3xl border border-zinc-100 shadow-xl shadow-zinc-200/40 text-center">
              <div className="w-20 h-20 bg-teal-50 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-teal-100 shadow-sm">
                <ShieldCheck className="w-10 h-10 text-teal-600" />
              </div>
              <h3 className="text-xl font-bold text-zinc-900">{profile?.nome}</h3>
              <p className="text-teal-600 font-medium text-sm mb-8">Administrador do Sistema</p>
              
              <div className="text-left space-y-4">
                <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100">
                  <p className="text-xs font-bold text-zinc-400 uppercase mb-1">E-mail</p>
                  <p className="text-zinc-900 font-medium">{profile?.email}</p>
                </div>
                <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100">
                  <p className="text-xs font-bold text-zinc-400 uppercase mb-1">Acesso</p>
                  <p className="text-zinc-900 font-medium">Administrador Full</p>
                </div>

                <div className="space-y-3 pt-4 border-t border-zinc-100">
                  <p className="text-xs font-bold text-zinc-400 uppercase text-left ml-1">Alterar Senha</p>
                  <input 
                    type="password"
                    placeholder="Nova senha"
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-teal-500 outline-none text-sm bg-zinc-50 focus:bg-white transition-all"
                    value={newAdminPassword}
                    onChange={e => setNewAdminPassword(e.target.value)}
                  />
                  <button 
                    onClick={handleUpdateMyPassword}
                    disabled={isUpdatingPassword || !newAdminPassword}
                    className="w-full py-3.5 rounded-xl bg-teal-600 text-white font-bold hover:bg-teal-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-teal-600/20 active:scale-[0.98]"
                  >
                    {isUpdatingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                    Salvar Nova Senha
                  </button>
                </div>
              </div>

              <button 
                onClick={() => signOut(auth)}
                className="mt-8 w-full py-3 rounded-xl border-2 border-red-100 text-red-600 font-bold hover:bg-red-50 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
              >
                <LogOut className="w-5 h-5" />
                Sair da Conta
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Deletion Confirmation Modal */}
      <AnimatePresence>
        {userToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-zinc-100"
            >
              <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-red-600 mx-auto mb-6 border border-red-100">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 text-center mb-2">Aviso de Remoção</h3>
              <p className="text-zinc-500 text-center mb-8 text-sm">
                Você está prestes a remover <strong>{userToDelete.nome}</strong> do banco de dados. 
                Ele perderá o acesso ao sistema imediatamente.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setUserToDelete(null)}
                  className="flex-1 py-3 rounded-xl font-bold text-zinc-500 hover:bg-zinc-100 transition-all active:scale-[0.98]"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleDeleteEmployee}
                  className="flex-1 py-3 rounded-xl font-bold bg-red-600 text-white hover:bg-red-700 transition-all shadow-lg shadow-red-600/20 active:scale-[0.98]"
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Quick Reset Modal */}
      <AnimatePresence>
        {quickResetUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-zinc-100 relative"
            >
              <button 
                onClick={() => {
                  setQuickResetUser(null);
                  setQuickResetPassword('');
                }}
                className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="w-16 h-16 bg-teal-50 rounded-2xl flex items-center justify-center text-teal-600 mx-auto mb-6 border border-teal-100">
                <Key className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 text-center mb-2">Nova Senha Rápida</h3>
              <p className="text-zinc-500 text-center mb-6 text-sm">
                Redefinir senha para <strong>{quickResetUser.nome}</strong>
              </p>

              <form onSubmit={handleQuickResetSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1 ml-1">Nova Senha</label>
                  <input 
                    type="password"
                    required
                    placeholder="Digite a nova senha"
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-teal-500 outline-none text-sm bg-zinc-50 focus:bg-white transition-all"
                    value={quickResetPassword}
                    onChange={e => setQuickResetPassword(e.target.value)}
                  />
                </div>

                <button 
                  type="submit"
                  disabled={isQuickResetting || !quickResetPassword}
                  className="w-full py-3.5 rounded-xl bg-teal-600 text-white font-bold hover:bg-teal-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-teal-600/20 active:scale-[0.98]"
                >
                  {isQuickResetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                  Confirmar Nova Senha
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Map Modal */}
      <AnimatePresence>
        {selectedMapRecord && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" 
            onClick={() => setSelectedMapRecord(null)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl overflow-hidden w-full max-w-2xl border border-zinc-100"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-4 border-b border-zinc-100 flex justify-between items-center bg-zinc-50">
                <div>
                  <h3 className="font-bold text-zinc-900">Localização do Ponto</h3>
                  <p className="text-xs text-zinc-500">{selectedMapRecord.userName} - {selectedMapRecord.timestamp?.toDate().toLocaleString()}</p>
                </div>
                <button 
                  onClick={() => setSelectedMapRecord(null)}
                  className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200 rounded-xl transition-colors"
                >
                  ✕
                </button>
              </div>
              <div className="w-full h-[400px] bg-zinc-100 relative">
                {selectedMapRecord.localizacao ? (
                  <iframe 
                    width="100%" 
                    height="100%" 
                    frameBorder="0" 
                    scrolling="no" 
                    marginHeight={0} 
                    marginWidth={0} 
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${selectedMapRecord.localizacao.longitude - 0.005},${selectedMapRecord.localizacao.latitude - 0.005},${selectedMapRecord.localizacao.longitude + 0.005},${selectedMapRecord.localizacao.latitude + 0.005}&layer=mapnik&marker=${selectedMapRecord.localizacao.latitude},${selectedMapRecord.localizacao.longitude}`}
                  ></iframe>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-zinc-400">
                    Localização não disponível
                  </div>
                )}
              </div>
              <div className="p-4 bg-zinc-50 border-t border-zinc-100 text-sm text-zinc-600 flex items-start gap-2">
                <MapPin className="w-5 h-5 text-teal-600 shrink-0" />
                <p>{selectedMapRecord.endereco}</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Export Modal */}
      <AnimatePresence>
        {showExportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-zinc-100 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-teal-50 rounded-2xl flex items-center justify-center text-teal-600 border border-teal-100">
                    <FileText className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-zinc-900">Exportar Pontos</h3>
                </div>
                <button onClick={() => setShowExportModal(false)} className="p-2 text-zinc-400 hover:bg-zinc-100 rounded-full transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1 ml-1">Data Inicial</label>
                    <input 
                      type="date" 
                      className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-teal-500 outline-none bg-zinc-50 focus:bg-white transition-all text-sm"
                      value={exportStartDate} 
                      onChange={e => setExportStartDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-500 uppercase mb-1 ml-1">Data Final</label>
                    <input 
                      type="date" 
                      className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-teal-500 outline-none bg-zinc-50 focus:bg-white transition-all text-sm"
                      value={exportEndDate} 
                      onChange={e => setExportEndDate(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase mb-2 ml-1">Funcionários</label>
                  <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-2 max-h-40 overflow-y-auto space-y-1">
                    <label className="flex items-center gap-3 p-2 hover:bg-white rounded-lg cursor-pointer transition-colors">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 text-teal-600 rounded border-zinc-300 focus:ring-teal-500"
                        checked={exportSelectedUsers.length === 0}
                        onChange={() => setExportSelectedUsers([])}
                      />
                      <span className="text-sm font-medium text-zinc-700">Todos os funcionários</span>
                    </label>
                    {employees.map(emp => (
                      <label key={emp.uid} className="flex items-center gap-3 p-2 hover:bg-white rounded-lg cursor-pointer transition-colors">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 text-teal-600 rounded border-zinc-300 focus:ring-teal-500"
                          checked={exportSelectedUsers.includes(emp.uid)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setExportSelectedUsers(prev => [...prev, emp.uid]);
                            } else {
                              setExportSelectedUsers(prev => prev.filter(id => id !== emp.uid));
                            }
                          }}
                        />
                        <span className="text-sm font-medium text-zinc-700">{emp.nome}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="pt-4 flex flex-col gap-3">
                  <button 
                    onClick={() => handleExport('pdf')}
                    disabled={isExporting}
                    className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-teal-600/20 flex items-center justify-center gap-2 disabled:opacity-70"
                  >
                    {isExporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                    Baixar PDF (Folha de Ponto)
                  </button>
                  <button 
                    onClick={() => handleExport('text')}
                    disabled={isExporting}
                    className="w-full bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-[#25D366]/20 flex items-center justify-center gap-2 disabled:opacity-70"
                  >
                    {isExporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Share2 className="w-5 h-5" />}
                    Compartilhar (WhatsApp)
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const docRef = doc(db, 'usuarios', firebaseUser.uid);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            const data = docSnap.data() as UserProfile;
            const isAdminEmail = 
              firebaseUser.email === 'alailsondeoliveirapng@gmail.com' || 
              firebaseUser.email === 'admin@cognitivo.ap';
            
            // Repair role if it's an admin email but not an admin role
            if (isAdminEmail && data.role !== 'admin') {
              const updatedProfile = { ...data, role: 'admin' as UserRole };
              await setDoc(docRef, updatedProfile);
              setProfile(updatedProfile);
            } else {
              setProfile(data);
            }
          } else {
            // If no profile exists (e.g. first admin), create it
            const isAdminEmail = 
              firebaseUser.email === 'alailsondeoliveirapng@gmail.com' || 
              firebaseUser.email === 'admin@cognitivo.ap';

            const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              nome: isAdminEmail ? 'Administrador' : (firebaseUser.displayName || 'Funcionário'),
              email: firebaseUser.email || '',
              role: isAdminEmail ? 'admin' : 'funcionario'
            };
            await setDoc(docRef, newProfile);
            setProfile(newProfile);
          }
        } catch (err: any) {
          console.error("Error fetching profile", err);
          setError(err.message);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
  }, []);

  if (loading) return <LoadingScreen />;

  return (
    <AuthContext.Provider value={{ user, profile, loading, error }}>
      <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 selection:bg-emerald-100 selection:text-emerald-900">
        {!user ? (
          <Login />
        ) : profile?.role === 'admin' ? (
          <AdminDashboard />
        ) : (
          <FuncionarioDashboard />
        )}
      </div>
    </AuthContext.Provider>
  );
}
