"use client";

import { useEffect, useState } from "react";
import { ImageGallery, type GalleryImage } from "@/components/dimaac/image-gallery";

// Ten curated portrait photos (Lummi License) matching the user specification.
// Alternates warm and cool tones for balanced visual rhythm as it spins.
const photos: GalleryImage[] = [
  { src: "https://ui.dimaac.com/media/portraits/tinted-glasses-4x5.jpg", alt: "Woman in purple-tinted sunglasses against an orange glow" },
  { src: "https://ui.dimaac.com/media/portraits/neon-profile-4x5.jpg", alt: "Profile of a woman in neon pink sunglasses on a blue background" },
  { src: "https://ui.dimaac.com/media/fashion/gold-visor-4x5.jpg", alt: "Profile with a gold headpiece on a yellow background" },
  { src: "https://ui.dimaac.com/media/portraits/red-coat-4x5.jpg", alt: "Person in a red coat against deep blue" },
  { src: "https://ui.dimaac.com/media/portraits/lime-blazer-4x5.jpg", alt: "Person in a lime green blazer on a pink background" },
  { src: "https://ui.dimaac.com/media/fashion/orange-visor-4x5.jpg", alt: "Woman in an orange visor on a teal background" },
  { src: "https://ui.dimaac.com/media/fashion/chunky-knit-4x5.jpg", alt: "Model in a chunky knit sweater and coral boots" },
  { src: "https://ui.dimaac.com/media/fashion/purple-hoodie-4x5.jpg", alt: "Person in a purple tie-dye hoodie in a concrete room" },
  { src: "https://ui.dimaac.com/media/portraits/platinum-blonde-4x5.jpg", alt: "Young man with platinum blonde hair in a yellow jacket" },
  { src: "https://ui.dimaac.com/media/fashion/orange-ring-4x5.jpg", alt: "Young man framed through an orange circle" },
];

// On phone screens the ring is more compact, so 2 photos are omitted to keep card sizes prominent
const skippedOnPhone = [6, 9];

export default function HeroCardGallery() {
  const [phone, setPhone] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const query = window.matchMedia("(max-width: 767px)");
    setPhone(query.matches);
    const update = () => setPhone(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const shown = mounted && phone ? photos.filter((_, index) => !skippedOnPhone.includes(index)) : photos;

  return (
    <div className="relative w-full h-full overflow-hidden flex items-center justify-center select-none">
      <ImageGallery
        images={shown}
        ringSize={phone ? 58 : 52}
        tileScale={0.9}
        radius={9}
        autoSpin={8}
        pauseOnHover={false}
        className="w-full h-full"
      />
    </div>
  );
}
