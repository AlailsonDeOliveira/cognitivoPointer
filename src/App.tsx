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
  serverTimestamp
} from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import { auth, db } from './firebase';
import { UserProfile, AttendanceRecord, UserRole } from './types';
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
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import firebaseConfig from '../firebase-applet-config.json';

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
  const [checkingIn, setCheckingIn] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'pontos'),
      where('userId', '==', user.uid),
      orderBy('timestamp', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      setRecords(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord)));
    });
  }, [user]);

  const handleCheckIn = async () => {
    setCheckingIn(true);
    setStatus(null);
    
    if (!navigator.geolocation) {
      setStatus({ type: 'error', msg: 'Geolocalização não suportada.' });
      setCheckingIn(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        const { latitude, longitude } = position.coords;
        
        // Reverse geocoding (Nominatim)
        let endereco = 'Localização desconhecida';
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          const data = await res.json();
          endereco = data.display_name || endereco;
        } catch (e) {
          console.error('Geocoding error', e);
        }

        await addDoc(collection(db, 'pontos'), {
          userId: user?.uid,
          userName: profile?.nome,
          timestamp: serverTimestamp(),
          localizacao: new GeoPoint(latitude, longitude),
          endereco
        });

        setStatus({ type: 'success', msg: 'Ponto batido com sucesso!' });
      } catch (err) {
        setStatus({ type: 'error', msg: 'Erro ao salvar ponto.' });
      } finally {
        setCheckingIn(false);
      }
    }, (err) => {
      setStatus({ type: 'error', msg: 'Permissão de localização negada.' });
      setCheckingIn(false);
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
        <button onClick={() => signOut(auth)} className="p-3 rounded-2xl bg-white border border-zinc-200 text-zinc-600 hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-all shadow-sm">
          <LogOut className="w-5 h-5" />
        </button>
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
              animate={checkingIn ? { rotate: 360 } : { rotate: 0 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            />
            <MapPin className="w-12 h-12 text-teal-600" />
          </div>
        </div>
        
        <h3 className="text-2xl font-bold text-zinc-900 mb-2 relative z-10">Registrar Ponto</h3>
        <p className="text-zinc-500 text-sm mb-8 max-w-xs relative z-10">Sua localização será capturada automaticamente para validar o registro.</p>

        <button 
          onClick={handleCheckIn}
          disabled={checkingIn}
          className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-teal-600/20 flex items-center justify-center gap-2 disabled:opacity-70 relative z-10 text-lg"
        >
          {checkingIn ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Bater Ponto Agora'}
        </button>

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

      <section>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-teal-600" />
            <h3 className="text-lg font-bold text-zinc-900">Seu Histórico</h3>
          </div>
          <span className="text-xs font-semibold bg-zinc-100 text-zinc-500 px-3 py-1 rounded-full">Últimos registros</span>
        </div>
        
        <div className="space-y-3">
          {records.length === 0 ? (
            <div className="text-center py-12 bg-zinc-50 rounded-3xl border border-dashed border-zinc-200">
              <p className="text-zinc-400 text-sm">Nenhum registro encontrado.</p>
            </div>
          ) : (
            records.map((record) => (
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
            ))
          )}
        </div>
      </section>
    </div>
  );
};

const AdminDashboard = () => {
  const { profile, user } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState<'users' | 'history' | 'profile'>('history');
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

  useEffect(() => {
    const qUsers = query(collection(db, 'usuarios'), where('role', '==', 'funcionario'));
    const unsubUsers = onSnapshot(qUsers, (snap) => {
      setEmployees(snap.docs.map(d => d.data() as UserProfile));
    });

    const qRecords = query(collection(db, 'pontos'), orderBy('timestamp', 'desc'));
    const unsubRecords = onSnapshot(qRecords, (snap) => {
      setAllRecords(snap.docs.map(d => ({ id: d.id, ...d.data() } as AttendanceRecord)));
    });

    return () => { unsubUsers(); unsubRecords(); };
  }, []);

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
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div className="relative mb-6">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
              <input 
                type="text"
                placeholder="Filtrar por nome do funcionário..."
                className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-zinc-200 focus:ring-2 focus:ring-teal-500 outline-none transition-all bg-white shadow-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
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
            </div>
          </motion.div>
        )}

        {activeTab === 'users' && (
          <motion.div 
            key="users"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
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
                        >
                          <Key className="w-3 h-3" />
                          Redefinir Senha
                        </button>
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
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
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

      {/* Map Modal */}
      <AnimatePresence>
        {selectedMapRecord && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedMapRecord(null)}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
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
