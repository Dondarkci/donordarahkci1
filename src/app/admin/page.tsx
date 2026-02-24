"use client";

import { useState, useEffect } from "react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { 
  ArrowLeft, 
  Search, 
  FileSpreadsheet, 
  Droplet, 
  Trash2, 
  Loader2, 
  PlusCircle,
  RefreshCcw,
  Settings2,
  Save,
  Lock,
  LogIn,
  LogOut,
  UserCheck,
  ServerCrash
} from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  useFirestore, 
  useAuth,
  useUser,
  useCollection, 
  useMemoFirebase,
  useDoc
} from "@/firebase";
import { 
  collection, 
  query, 
  orderBy, 
  writeBatch, 
  doc, 
  getDocs, 
  updateDoc,
  setDoc,
  serverTimestamp
} from "firebase/firestore";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";

export default function AdminDashboard() {
  const firestore = useFirestore();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [search, setSearch] = useState("");
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [editingEvent, setEditingEvent] = useState<{ id: string, location: string, maxQuota: number } | null>(null);

  // Check if current user is an admin in Firestore
  const adminRoleRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, "admins", user.uid);
  }, [firestore, user]);
  
  const { data: adminRole, isLoading: isAdminRoleLoading } = useDoc(adminRoleRef);

  // Real-time data from Firestore (only fetched if admin)
  const participantsQuery = useMemoFirebase(() => {
    if (!firestore || !adminRole) return null;
    return query(collection(firestore, "participants"), orderBy("registrationDateTime", "desc"));
  }, [firestore, adminRole]);

  const eventsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "bloodDonationEvents"), orderBy("date", "asc"));
  }, [firestore]);

  const { data: participants, isLoading: isParticipantsLoading, error: participantsError } = useCollection(participantsQuery);
  const { data: events, isLoading: isEventsLoading, error: eventsError } = useCollection(eventsQuery);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    setIsActionLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast({ title: "Login Berhasil", description: "Selamat datang kembali, Admin." });
    } catch (err: any) {
      toast({ 
        variant: "destructive", 
        title: "Login Gagal", 
        description: "Email atau password salah, atau Anda tidak memiliki akses admin." 
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleLogout = async () => {
    if (!auth) return;
    await signOut(auth);
    toast({ title: "Berhasil Logout" });
  };

  // Helper function to setup initial admin role (Only use this once to promote your UID)
  const setupFirstAdmin = async () => {
    if (!firestore || !user) return;
    setIsActionLoading(true);
    const adminRef = doc(firestore, "admins", user.uid);
    const adminData = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || 'Admin',
        createdAt: serverTimestamp()
    };
    
    setDoc(adminRef, adminData)
      .then(() => {
        toast({ title: "Admin Role Berhasil Dibuat" });
      })
      .catch(async (e) => {
        const permissionError = new FirestorePermissionError({
          path: adminRef.path,
          operation: 'create',
          requestResourceData: adminData,
        });
        errorEmitter.emit('permission-error', permissionError);
        toast({ variant: "destructive", title: "Gagal membuat role", description: "Pastikan Rules mengizinkan atau hubungi developer." });
      })
      .finally(() => {
        setIsActionLoading(false);
      });
  };

  const handleUpdateQuota = async () => {
    if (!firestore || !editingEvent) return;
    setIsActionLoading(true);
    
    const eventRef = doc(firestore, "bloodDonationEvents", editingEvent.id);
    const updateData = { maxQuota: Number(editingEvent.maxQuota) };

    updateDoc(eventRef, updateData)
      .then(() => {
        toast({ title: "Kuota berhasil diperbarui" });
        setEditingEvent(null);
      })
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: eventRef.path,
          operation: 'update',
          requestResourceData: updateData,
        });
        errorEmitter.emit('permission-error', permissionError);
        toast({ variant: "destructive", title: "Gagal update kuota", description: error.message });
      })
      .finally(() => {
        setIsActionLoading(false);
      });
  };

  const handleReset = async () => {
    if (!firestore) return;
    setIsActionLoading(true);
    try {
      const batch = writeBatch(firestore);
      const participantsSnapshot = await getDocs(collection(firestore, "participants"));
      participantsSnapshot.forEach(d => batch.delete(d.ref));
      
      const eventsSnapshot = await getDocs(collection(firestore, "bloodDonationEvents"));
      eventsSnapshot.forEach(eventDoc => {
        batch.update(eventDoc.ref, {
          currentRegistrations: 0
        });
      });

      await batch.commit();
      toast({ title: "Data berhasil direset" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Gagal reset data", description: e.message });
    } finally {
      setIsActionLoading(false);
    }
  };

  const seedEvents = async () => {
    if (!firestore) return;
    setIsActionLoading(true);
    try {
      const batch = writeBatch(firestore);
      const defaultEvents = [
        { id: 'ev1', location: 'Stasiun Juanda', date: '2026-03-30', maxQuota: 50, currentRegistrations: 0 },
        { id: 'ev2', location: 'GTO Stasiun Depok', date: '2026-03-30', maxQuota: 30, currentRegistrations: 0 },
        { id: 'ev3', location: 'Stasiun Juanda', date: '2026-03-31', maxQuota: 50, currentRegistrations: 0 },
        { id: 'ev4', location: 'Stasiun BNI City', date: '2026-03-31', maxQuota: 40, currentRegistrations: 0 },
      ];
      defaultEvents.forEach((ev) => {
        batch.set(doc(firestore, "bloodDonationEvents", ev.id), ev);
      });
      await batch.commit();
      toast({ title: "Jadwal berhasil diinisialisasi" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Gagal inisialisasi", description: e.message });
    } finally {
      setIsActionLoading(false);
    }
  };

  const downloadExcel = () => {
    if (!participants || participants.length === 0) return;
    const headers = ["ID", "Nama Lengkap", "NIK", "WhatsApp", "Lokasi", "Tanggal", "Waktu Pendaftaran"];
    const rows = participants.map(r => {
      const event = events?.find(e => e.id === r.bloodDonationEventId);
      return [
        r.id,
        r.fullName,
        r.nik,
        r.whatsappNumber,
        event ? event.location : 'N/A',
        event ? event.date : '-',
        r.registrationDateTime ? new Date(r.registrationDateTime).toLocaleString('id-ID') : '-'
      ];
    });
    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n"
      + rows.map(e => e.map(cell => `"${(cell || "").toString().replace(/"/g, '""')}"`).join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Rekap_Donor_KCI_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isUserLoading || isAdminRoleLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="font-bold">Memeriksa hak akses...</p>
      </div>
    );
  }

  // Login Screen if not authenticated or not an admin
  if (!user || !adminRole) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-6">
        <Card className="w-full max-w-md shadow-2xl border-t-4 border-t-primary">
          <CardHeader className="text-center space-y-1">
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-primary/10 rounded-full">
                <Lock className="w-8 h-8 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold uppercase tracking-tight">Admin Dashboard</CardTitle>
            <CardDescription>
              Silakan masuk dengan akun email administrator untuk melihat rekapan pendaftar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Administrator</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="admin@kci.id" 
                  required 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input 
                  id="password" 
                  type="password" 
                  required 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full h-12 text-lg font-bold gap-2" disabled={isActionLoading}>
                {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                Masuk ke Dashboard
              </Button>
            </form>

            <div className="mt-8 pt-6 border-t text-center space-y-4">
              <Link href="/">
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary">
                  <ArrowLeft className="w-4 h-4 mr-2" /> Kembali ke Pendaftaran
                </Button>
              </Link>
              {user && !adminRole && (
                <div className="p-4 bg-yellow-50 border border-yellow-100 rounded-lg text-xs text-yellow-800 space-y-2">
                  <p className="font-bold flex items-center gap-1">
                    <UserCheck className="w-3 h-3" /> Akun Terdeteksi: {user.email}
                  </p>
                  <p>Akun Anda belum memiliki izin akses Admin.</p>
                  <Button variant="outline" size="sm" className="w-full text-[10px] h-7 bg-white" onClick={setupFirstAdmin} disabled={isActionLoading}>
                    {isActionLoading ? <Loader2 className="w-3 h-3 animate-spin"/> : null}
                    Promosikan Akun Ini Jadi Admin (Prototyping)
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Full Admin Dashboard
  const filteredData = (participants || [])
    .filter(item => 
      (item.fullName || "").toLowerCase().includes(search.toLowerCase()) ||
      (item.nik || "").includes(search)
    );

  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-4 mb-2">
              <Link href="/" className="text-primary flex items-center gap-2 text-sm font-bold hover:underline">
                <ArrowLeft className="w-4 h-4" /> Ke Pendaftaran
              </Link>
              <div className="h-4 w-px bg-border" />
              <button onClick={handleLogout} className="text-muted-foreground flex items-center gap-2 text-sm font-medium hover:text-destructive transition-colors">
                <LogOut className="w-4 h-4" /> Keluar ({user.email})
              </button>
            </div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Droplet className="w-6 h-6 text-primary fill-current" />
              Dashboard Admin
            </h1>
            <p className="text-muted-foreground">Monitoring pendaftaran donor darah PT. KCI (Realtime)</p>
          </div>
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            {(!events || events.length === 0) && (
              <Button onClick={seedEvents} disabled={isActionLoading} variant="secondary" className="gap-2">
                <PlusCircle className="w-4 h-4" /> Inisialisasi Jadwal
              </Button>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" disabled={isActionLoading || !participants || participants.length === 0} className="gap-2 text-destructive">
                  <Trash2 className="w-4 h-4" /> Reset Data
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Hapus Seluruh Data?</AlertDialogTitle>
                  <AlertDialogDescription>Tindakan ini permanen. Semua pendaftar akan dihapus dan kuota dikosongkan.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Batal</AlertDialogCancel>
                  <AlertDialogAction onClick={handleReset} className="bg-destructive text-white">Ya, Hapus</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button onClick={downloadExcel} disabled={!participants || participants.length === 0} className="gap-2 bg-green-700 hover:bg-green-800">
              <FileSpreadsheet className="w-4 h-4" /> Download Excel
            </Button>
          </div>
        </div>

        {/* Quota Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          { isEventsLoading ? ([1,2,3,4].map(i => <Card key={i}><CardHeader><CardTitle><Loader2 className="animate-spin" /></CardTitle></CardHeader><CardContent><p>Loading...</p></CardContent></Card>)) :
            events?.map(opt => (
            <Card key={opt.id} className="border-l-4 border-l-primary shadow-sm relative">
              <CardHeader className="p-4 pb-2 flex flex-row items-start justify-between">
                <div>
                  <CardTitle className="text-sm font-bold">{opt.location}</CardTitle>
                  <p className="text-xs text-muted-foreground">{opt.date}</p>
                </div>
                <Dialog onOpenChange={(open) => open ? setEditingEvent({ id: opt.id, location: opt.location, maxQuota: opt.maxQuota }) : setEditingEvent(null)}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8"><Settings2 className="w-4 h-4" /></Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Edit Kuota: {opt.location}</DialogTitle></DialogHeader>
                    <div className="py-4 space-y-2">
                      <Label>Kapasitas Maksimal</Label>
                      <Input 
                        type="number" 
                        value={editingEvent?.maxQuota ?? opt.maxQuota} 
                        onChange={(e) => setEditingEvent(prev => prev ? { ...prev, maxQuota: Number(e.target.value) } : null)}
                      />
                    </div>
                    <DialogFooter>
                      <Button onClick={handleUpdateQuota} disabled={isActionLoading}>Simpan</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-primary">{opt.currentRegistrations || 0}</span>
                  <span className="text-sm text-muted-foreground">/ {opt.maxQuota} Slot</span>
                </div>
                <div className="w-full bg-muted rounded-full h-1.5 mt-2">
                  <div 
                    className={`h-full rounded-full transition-all ${((opt.currentRegistrations || 0) / opt.maxQuota) >= 1 ? 'bg-red-500' : 'bg-primary'}`}
                    style={{ width: `${Math.min(((opt.currentRegistrations || 0) / opt.maxQuota) * 100, 100)}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
          { eventsError && <Card className="col-span-full bg-destructive/10 text-destructive"><CardHeader><CardTitle className="flex gap-2"><ServerCrash/> Error Memuat Jadwal</CardTitle></CardHeader><CardContent><p className="font-mono text-xs">{eventsError.message}</p></CardContent></Card>}
        </div>

        {/* Table List */}
        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
          <div className="p-4 border-b bg-muted/20 flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Cari nama atau NIK..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="text-sm font-bold bg-white px-4 py-2 rounded-full border">
              Total: {filteredData.length} Orang
            </div>
            { isParticipantsLoading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Memuat Pendaftar...</div>}
            { participantsError && <div className="flex items-center gap-2 text-sm text-destructive"><ServerCrash className="w-4 h-4" /> Gagal Memuat Pendaftar</div>}
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Lengkap</TableHead>
                  <TableHead>NIK</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Lokasi</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead className="text-right">Waktu Daftar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.length > 0 ? (
                  filteredData.map((reg) => {
                    const event = events?.find(e => e.id === reg.bloodDonationEventId);
                    return (
                      <TableRow key={reg.id}>
                        <TableCell className="font-bold">{reg.fullName}</TableCell>
                        <TableCell className="font-mono text-xs">{reg.nik}</TableCell>
                        <TableCell>{reg.whatsappNumber}</TableCell>
                        <TableCell><span className="text-xs font-bold">{event?.location || 'N/A'}</span></TableCell>
                        <TableCell><span className="text-xs">{event?.date || '-'}</span></TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {reg.registrationDateTime ? new Date(reg.registrationDateTime).toLocaleString('id-ID') : '-'}
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow><TableCell colSpan={6} className="text-center py-20 opacity-50 italic">
                    {isParticipantsLoading ? 'Memuat data...' : (participantsError ? 'Gagal memuat data pendaftar.' : 'Belum ada data pendaftar.')}
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}
