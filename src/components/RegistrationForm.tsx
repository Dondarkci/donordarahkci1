"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent } from "@/components/ui/card";
import { donorWhatsAppConfirmation } from "@/ai/flows/donor-whatsapp-confirmation";
import { CheckCircle2, Droplet, MapPin, Users, Loader2, CalendarX, ServerCrash } from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { 
  useFirestore, 
  useCollection, 
  useMemoFirebase
} from "@/firebase";
import { 
  collection, 
  doc, 
  runTransaction, 
  serverTimestamp, 
  query, 
  orderBy 
} from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";

const formSchema = z.object({
  id: z.string().optional(),
  fullName: z.string().min(3, "Nama lengkap harus diisi, minimal 3 karakter."),
  ktpNumber: z.string().length(16, "Nomor Induk Kependudukan (NIK) harus 16 digit."),
  whatsappNumber: z.string().min(10, "Nomor WhatsApp tidak valid, minimal 10 digit.").regex(/^08[0-9]{8,}$/, "Format No. WhatsApp salah, contoh: 08123456789"),
  locationId: z.string({
    required_error: "Silakan pilih lokasi dan tanggal.",
  }),
});

export function RegistrationForm() {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState("");
  const [loadingTimeout, setLoadingTimeout] = useState(false);

  // Real-time events from Firestore
  const eventsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, "bloodDonationEvents"), orderBy("date", "asc"));
  }, [firestore]);
  
  const { data: events, isLoading: isEventsLoading, error: eventsError } = useCollection(eventsQuery);

  // Timeout for loading indicator
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isEventsLoading) {
      timer = setTimeout(() => {
        setLoadingTimeout(true);
      }, 8000); // 8 seconds
    }
    return () => clearTimeout(timer);
  }, [isEventsLoading]);


  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: "",
      ktpNumber: "",
      whatsappNumber: "",
      locationId: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!firestore) {
      toast({
        variant: "destructive",
        title: "Koneksi Gagal",
        description: "Tidak dapat terhubung ke server. Mohon coba lagi.",
      });
      return;
    };
    
    setIsSubmitting(true);
    setConfirmationMessage("Sedang menyiapkan pesan konfirmasi...");
    
    try {
      const selectedEvent = events?.find(e => e.id === values.locationId);
      if (!selectedEvent) throw new Error("Event tidak ditemukan");

      // Transaction for atomic quota update
      const eventRef = doc(firestore, "bloodDonationEvents", values.locationId);
      const participantRef = doc(collection(firestore, "participants"));

      await runTransaction(firestore, async (transaction) => {
        const eventDoc = await transaction.get(eventRef);
        if (!eventDoc.exists()) throw new Error("Event tidak tersedia");
        
        const eventData = eventDoc.data();
        const currentCount = eventData.currentRegistrations || 0;
        const maxQuota = eventData.maxQuota || 0;
        
        if (currentCount >= maxQuota) {
          throw new Error("Maaf, kuota untuk lokasi ini sudah penuh.");
        }
        
        transaction.update(eventRef, {
          currentRegistrations: currentCount + 1
        });
        
        transaction.set(participantRef, {
          id: participantRef.id,
          fullName: values.fullName,
          nik: values.ktpNumber,
          whatsappNumber: values.whatsappNumber,
          bloodDonationEventId: values.locationId,
          registrationDateTime: new Date().toISOString(),
          createdAt: serverTimestamp()
        });
      });

      setIsSuccess(true);
      form.reset();

      // AI generated confirmation
      try {
        const result = await donorWhatsAppConfirmation({
          fullName: values.fullName,
          whatsappNumber: values.whatsappNumber,
          locationAndDate: `${selectedEvent.location} pada ${selectedEvent.date}`,
        });
        setConfirmationMessage(result.whatsappMessage);
      } catch (aiError) {
        setConfirmationMessage(`Hallo ${values.fullName}, selamat anda terdaftar sebagai peserta donor darah PT. Kereta Commuter Indonesia. Sampai jumpa di ${selectedEvent.location} pada ${selectedEvent.date}`);
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Pendaftaran Gagal",
        description: error.message || "Terjadi kesalahan saat mendaftar.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleFormError = (errors: any) => {
    if(Object.keys(errors).length > 0) {
      toast({
        variant: "destructive",
        title: "Formulir Belum Lengkap",
        description: "Mohon periksa kembali isian Anda. Pastikan semua kolom terisi dengan benar.",
      });
    }
  }

  if (isEventsLoading && !loadingTimeout) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">Memuat jadwal donor...</p>
      </div>
    );
  }
  
  if (eventsError || loadingTimeout && !events?.length) {
     return (
      <Card className="border-dashed border-2 bg-destructive/5">
        <CardContent className="flex flex-col items-center justify-center p-12 text-center space-y-4">
          <ServerCrash className="w-12 h-12 text-destructive opacity-50" />
          <div className="space-y-1">
            <h3 className="font-bold text-xl text-destructive">Gagal Memuat Jadwal Donor</h3>
            <p className="text-muted-foreground text-sm max-w-sm">
              Tidak dapat mengambil data dari server. Ini bisa terjadi jika database belum siap atau ada masalah koneksi.
            </p>
             <p className="text-xs text-muted-foreground pt-2 font-mono max-w-sm truncate">{eventsError?.message}</p>
          </div>
           <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
              Coba Lagi
            </Button>
            <Link href="/admin">
              <Button variant="default" size="sm">Cek Admin</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }


  if (!events || events.length === 0) {
    return (
      <Card className="border-dashed border-2 bg-muted/30">
        <CardContent className="flex flex-col items-center justify-center p-12 text-center space-y-4">
          <CalendarX className="w-12 h-12 text-muted-foreground opacity-20" />
          <div className="space-y-1">
            <h3 className="font-bold text-xl">Belum ada Jadwal Tersedia</h3>
            <p className="text-muted-foreground text-sm max-w-xs">
              Saat ini belum ada jadwal donor darah yang terdaftar di sistem. Silakan setup jadwal di dashboard admin.
            </p>
          </div>
          <Link href="/admin">
            <Button variant="outline" size="sm">
              Setup Jadwal (Admin)
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit, handleFormError)} className="space-y-6">
          <Card className="border-none shadow-lg overflow-hidden">
            <CardContent className="p-6 md:p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nama Lengkap</FormLabel>
                      <FormControl>
                        <Input placeholder="Contoh: Roni Algifari" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="ktpNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nomor Induk Kependudukan (NIK)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="16 digit angka" {...field} maxLength={16} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="whatsappNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>No WhatsApp</FormLabel>
                      <FormControl>
                        <Input type="tel" placeholder="Contoh: 08123456789" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="locationId"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel className="text-lg">Lokasi dan Tanggal</FormLabel>
                      <FormDescription>
                        Pilih jadwal donor darah yang tersedia. Kuota realtime.
                      </FormDescription>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          value={field.value}
                          className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                        >
                          {events.map((option) => {
                            const count = option.currentRegistrations || 0;
                            const isFull = count >= option.maxQuota;
                            
                            return (
                              <FormItem key={option.id}>
                                <FormControl>
                                  <RadioGroupItem 
                                    value={option.id} 
                                    className="sr-only" 
                                    disabled={isFull}
                                  />
                                </FormControl>
                                <FormLabel 
                                  className={`
                                    flex flex-col gap-2 p-4 border rounded-xl cursor-pointer transition-all
                                    ${isFull ? 'opacity-50 cursor-not-allowed bg-muted/50' : 'bg-white hover:border-primary/50'}
                                    ${field.value === option.id 
                                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20' 
                                      : 'border-border'}
                                  `}
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="flex gap-3">
                                      <div className={`p-2 rounded-lg ${field.value === option.id ? 'bg-primary text-white' : 'bg-muted'}`}>
                                        <MapPin className="w-4 h-4" />
                                      </div>
                                      <div className="flex flex-col">
                                        <span className="font-semibold text-sm">{option.location}</span>
                                        <span className="text-xs text-muted-foreground">{option.date}</span>
                                      </div>
                                    </div>
                                    <div className={`px-2 py-0.5 rounded text-[10px] font-bold ${isFull ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
                                      {isFull ? 'Penuh' : `${option.maxQuota - count} Slot`}
                                    </div>
                                  </div>
                                </FormLabel>
                              </FormItem>
                            );
                          })}
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 text-lg font-bold transition-transform active:scale-[0.98]"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Memproses...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Droplet className="w-5 h-5 fill-current" />
                    Daftar Sekarang
                  </div>
                )}
              </Button>
            </CardContent>
          </Card>
        </form>
      </Form>

      <Dialog open={isSuccess} onOpenChange={setIsSuccess}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-green-100 rounded-full">
                <CheckCircle2 className="w-12 h-12 text-green-600" />
              </div>
            </div>
            <DialogTitle className="text-2xl text-center">Selamat anda telah terdaftar</DialogTitle>
            <DialogDescription className="text-center">
              Terima kasih telah bersedia mendonorkan darah Anda. Satu tetes darah Anda sangat berarti.
            </DialogDescription>
          </DialogHeader>
          
          <div className="bg-muted p-4 rounded-lg space-y-3">
            <h4 className="font-bold text-sm flex items-center gap-2">
              <Users className="w-4 h-4" /> Notifikasi WhatsApp:
            </h4>
            <div className="text-sm italic text-muted-foreground bg-white p-3 rounded border border-border whitespace-pre-wrap">
              {confirmationMessage || <Loader2 className="animate-spin w-4 h-4" />}
            </div>
          </div>

          <DialogFooter className="sm:justify-center">
            <Button onClick={() => setIsSuccess(false)} variant="default" className="w-full">
              Selesai
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
