import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { nama, whatsapp, lokasi } = body;

    if (!nama || !whatsapp || !lokasi) {
      return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 });
    }

    // 1️⃣ Simpan ke Firestore
    await db.collection("pendaftaran").add({
      nama,
      whatsapp,
      lokasi,
      createdAt: new Date(),
    });

    // 2️⃣ Formatting nomor WhatsApp untuk Ponte (Menghapus spasi/- dan ganti 0 jadi 62)
    const cleanNumber = whatsapp.replace(/[^0-9]/g, "");
    const finalNumber = cleanNumber.startsWith("0") ? "62" + cleanNumber.slice(1) : cleanNumber;

    // 3️⃣ Kirim WhatsApp via Ponte
    const waResponse = await fetch("https://api.ponte.id/send-message", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.PONTE_API_KEY}`,
      },
      body: JSON.stringify({
        device_id: process.env.PONTE_DEVICE_ID,
        number: finalNumber,
        message: `Halo ${nama}, pendaftaran lokasi ${lokasi} berhasil.`,
      }),
    });

    return NextResponse.json({
      message: "Pendaftaran berhasil & WA terkirim",
      wa_sent: waResponse.ok
    });

  } catch (error: any) {
    console.error("ERROR REGISTER:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan server", details: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ status: "API Register Aktif" });
}