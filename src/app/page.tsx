
"use client";

import { RegistrationForm } from "@/components/RegistrationForm";
import { Droplet, TrainFront, ChevronRight, Download, Loader2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useUser, useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { doc } from "firebase/firestore";

export default function RegistrationPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  // Check if current user is an admin
  const adminRoleRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, "admins", user.uid);
  }, [firestore, user]);

  const { data: adminRole, isLoading: isAdminCheckLoading } = useDoc(adminRoleRef);

  // Logic: 
  // 1. Tampilkan jika belum login sama sekali (supaya admin bisa klik untuk login)
  // 2. Tampilkan jika sudah login dan terverifikasi sebagai admin
  // 3. Sembunyikan jika login sebagai Anonymous (ini adalah peserta/bukan admin)
  const isAnonymous = user?.isAnonymous;
  const showAdminButton = !user || (!isAnonymous && (!!adminRole || isAdminCheckLoading));

  return (
    <main className="min-h-screen pb-20 bg-background selection:bg-primary/20">
      {/* Header Branding */}
      <header className="bg-primary text-primary-foreground py-8 px-4 shadow-xl mb-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <TrainFront size={200} />
        </div>
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-6 relative z-10">
          <div className="bg-white p-4 rounded-2xl shadow-lg animate-in zoom-in duration-500">
            <Droplet className="w-16 h-16 text-primary animate-pulse" fill="currentColor" />
          </div>
          <div className="text-center md:text-left space-y-2">
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight">
              Donor Darah PT. Kereta Commuter Indonesia
            </h1>
            <p className="text-primary-foreground/90 text-lg max-w-2xl font-medium">
              Satu tetes darah yang Anda berikan sangat berarti bagi sesama.
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4">
        {/* Intro Section */}
        <section className="mb-10 space-y-4 text-center md:text-left">
          <h2 className="text-2xl font-bold text-primary flex items-center justify-center md:justify-start gap-2">
            Hallo Insan KAI Commuter
            <ChevronRight className="w-5 h-5 text-secondary" />
          </h2>
          <p className="text-muted-foreground text-lg leading-relaxed">
            Silahkan isi formulir berikut dengan data yang benar untuk mengikuti kegiatan donor darah. 
            Pastikan anda memilih Lokasi dan Tanggal sesuai ketersediaan.
          </p>
        </section>

        {/* Form Section - Tampil Langsung Tanpa Auth */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
          <RegistrationForm />
        </div>

        {/* Admin Link - Only visible to potential admins or verified admins */}
        {showAdminButton && (
          <div className="mt-12 flex justify-center animate-in fade-in zoom-in duration-300">
            <Link href="/admin">
              <Button variant="outline" className="text-primary border-primary hover:bg-primary/5 transition-colors flex items-center gap-2 group">
                {isAdminCheckLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : adminRole ? (
                  <ShieldCheck className="w-4 h-4 text-green-600" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                {adminRole ? "Dashboard Admin Terverifikasi" : "Masuk ke Dashboard Admin"}
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* Footer Branding */}
      <footer className="mt-20 border-t border-border pt-10 text-center text-muted-foreground px-4">
        <div className="flex items-center justify-center gap-4 mb-4 opacity-60 grayscale hover:grayscale-0 transition-all cursor-default">
          <TrainFront className="w-6 h-6" />
          <span className="font-bold">KAI Commuter</span>
        </div>
        <p className="text-sm">© 2026 PT. Kereta Commuter Indonesia. Seluruh hak cipta dilindungi.</p>
      </footer>
    </main>
  );
}
