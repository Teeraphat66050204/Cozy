import { useEffect, useRef, useState } from "react";
import PolaroidBoard from "./components/PolaroidBoard";

const INITIAL_VOLUME = 0.05;
const ONBOARDING_KEY = "cozy_board_onboarding_seen_v2";
const MOBILE_BREAKPOINT = 768;

function getInitialPlayerPos() {
  if (typeof window === "undefined") return { x: 16, y: 16 };

  const isMobile = window.innerWidth < MOBILE_BREAKPOINT;
  const width = isMobile ? 220 : 290;
  const height = isMobile ? 82 : 92;
  return {
    x: Math.max(8, window.innerWidth - width - 12),
    y: isMobile ? 108 : Math.max(8, window.innerHeight - height - 16),
  };
}

export default function App() {
  const playerRef = useRef(null);
  const audioRef = useRef(null);
  const dragRef = useRef({ dragging: false, offsetX: 0, offsetY: 0 });

  const [playerHidden, setPlayerHidden] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(ONBOARDING_KEY) !== "1";
  });
  const [playerPos, setPlayerPos] = useState(getInitialPlayerPos);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const applyInitialVolume = () => {
      audio.volume = INITIAL_VOLUME;
    };

    applyInitialVolume();
    audio.muted = true;
    audio.defaultMuted = true;
    audio.addEventListener("loadedmetadata", applyInitialVolume);
    audio.autoplay = true;
    audio.play().catch(() => {
      // Browser may block autoplay with sound until user interacts.
    });

    const unlockAudio = () => {
      audio.muted = false;
      audio.defaultMuted = false;
      applyInitialVolume();
      audio.play().catch(() => {});
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
      window.removeEventListener("touchstart", unlockAudio);
    };

    window.addEventListener("pointerdown", unlockAudio);
    window.addEventListener("keydown", unlockAudio);
    window.addEventListener("touchstart", unlockAudio);

    return () => {
      audio.removeEventListener("loadedmetadata", applyInitialVolume);
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
      window.removeEventListener("touchstart", unlockAudio);
    };
  }, []);

  useEffect(() => {
    const onPointerMove = (event) => {
      if (!dragRef.current.dragging) return;

      const width = playerRef.current?.offsetWidth ?? 280;
      const height = playerRef.current?.offsetHeight ?? 90;
      const nextX = event.clientX - dragRef.current.offsetX;
      const nextY = event.clientY - dragRef.current.offsetY;

      setPlayerPos({
        x: Math.min(Math.max(8, nextX), Math.max(8, window.innerWidth - width - 8)),
        y: Math.min(Math.max(8, nextY), Math.max(8, window.innerHeight - height - 8)),
      });
    };

    const onPointerUp = () => {
      dragRef.current.dragging = false;
      document.body.style.cursor = "";
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, []);

  useEffect(() => {
    const onResize = () => {
      setPlayerPos((prev) => {
        const isMobile = window.innerWidth < MOBILE_BREAKPOINT;
        const width = playerRef.current?.offsetWidth ?? (isMobile ? 220 : 280);
        const height = playerRef.current?.offsetHeight ?? (isMobile ? 82 : 90);
        const maxX = Math.max(8, window.innerWidth - width - 8);
        const maxY = Math.max(8, window.innerHeight - height - 8);

        return {
          x: Math.min(Math.max(8, prev.x), maxX),
          y: isMobile ? 108 : Math.min(Math.max(8, prev.y), maxY),
        };
      });
    };

    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const handleDragStart = (event) => {
    if (!playerRef.current) return;

    const rect = playerRef.current.getBoundingClientRect();
    dragRef.current = {
      dragging: true,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    };
    document.body.style.cursor = "grabbing";
  };

  const closeOnboarding = () => {
    setShowOnboarding(false);
    window.localStorage.setItem(ONBOARDING_KEY, "1");
  };

  return (
    <main className="h-screen w-full bg-transparent text-[#5d4736]">
      <header className="fixed inset-x-0 top-0 z-30 border-b border-[#e3d0b9]/80 bg-[#fff9f1]/85 px-4 py-4 backdrop-blur-xl sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-['Playfair_Display'] text-3xl font-semibold tracking-tight text-[#4e3726]">
              Cozy wall room
            </h1>
            <p className="mt-1 text-sm text-[#8e7966]">Wall of the room</p>
          </div>

          <button
            type="button"
            onClick={() => setShowOnboarding(true)}
            className="rounded-xl border border-[#dcc6ab] bg-[#fff7ed] px-3 py-1.5 text-xs font-medium text-[#6c4f37] hover:bg-[#f9ecd9]"
          >
            วิธีใช้
          </button>
        </div>
      </header>

      <section className="flex h-full w-full flex-col pt-[92px]">
        <PolaroidBoard />
      </section>

      {playerHidden ? (
        <button
          type="button"
          onClick={() => setPlayerHidden(false)}
          className="fixed bottom-3 right-3 z-40 rounded-full border border-[#e3d0b9] bg-[#fff9f1]/95 px-4 py-2 text-sm font-medium text-[#6c4f37] shadow-[0_10px_22px_rgba(74,48,30,0.18)] backdrop-blur"
        >
          แสดงเพลง
        </button>
      ) : (
        <div
          ref={playerRef}
          style={{ left: `${playerPos.x}px`, top: `${playerPos.y}px` }}
          className="fixed z-40 w-[220px] rounded-2xl border border-[#e3d0b9] bg-[#fff9f1]/95 p-2 shadow-[0_10px_22px_rgba(74,48,30,0.18)] backdrop-blur sm:w-[280px]"
        >
          <div
            onPointerDown={handleDragStart}
            className="mb-1 flex cursor-grab items-center justify-between rounded-lg bg-[#f8eee1] px-2 py-1"
          >
            <p className="text-xs text-[#8e7966]">กำลังเล่นเพลง</p>
            <button
              type="button"
              onClick={() => setPlayerHidden(true)}
              className="rounded px-2 py-0.5 text-xs text-[#7a5b42] hover:bg-[#eddcc7]"
            >
              ซ่อน
            </button>
          </div>

          <audio ref={audioRef} controls autoPlay loop preload="metadata" className="h-10 w-full">
            <source src="/music/bloom.mp3" type="audio/mpeg" />
          </audio>
        </div>
      )}

      {showOnboarding ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#2f1e12]/35 px-4">
          <div className="w-full max-w-md rounded-2xl border border-[#e3d0b9] bg-[#fff9f1] p-5 shadow-[0_24px_60px_rgba(57,35,20,0.28)]">
            <h2 className="font-['Itim'] text-2xl font-semibold text-[#4e3726]">วิธีใช้งานแบบเร็ว</h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 font-['Itim'] text-base text-[#775f4b]">
              <li>กด `Upload` เพื่อเพิ่มรูปลงบอร์ดร่วมกัน</li>
              <li>ลาก หมุน และปรับขนาดรูปได้ ดับเบิลคลิกเพื่อแก้แคปชัน</li>
              <li>`Normal / Hanging Mode` ใช้สลับรูปแบบการแสดงผล</li>
              <li>ในโหมดเชือก กด `Draw Rope` แล้วลากบนพื้นที่ว่างเพื่อวาดเส้นเชือก</li>
              <li>เลือกรูปที่ต้องการ แล้วกด `Delete` เพื่อลบ</li>
            </ul>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={closeOnboarding}
                className="rounded-xl bg-[#6f4c33] px-4 py-2 font-['Itim'] text-base font-medium text-white hover:bg-[#5f402a]"
              >
                เริ่มใช้งาน
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
