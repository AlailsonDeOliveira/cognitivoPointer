export type UserRole = 'admin' | 'funcionario';

export interface UserProfile {
  uid: string;
  nome: string;
  email: string;
  role: UserRole;
}

export interface AttendanceRecord {
  id?: string;
  userId: string;
  userName: string;
  timestamp: any; // Firestore Timestamp
  localizacao: {
    latitude: number;
    longitude: number;
  };
  endereco: string;
}

export interface AllowedLocation {
  id?: string;
  nome: string;
  latitude: number;
  longitude: number;
  raio: number; // in meters
}
