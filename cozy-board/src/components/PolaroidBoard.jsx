import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Layer, Line, Rect, Stage } from "react-konva";
import PolaroidCard from "./PolaroidCard";
import clipSrc from "../assets/clip.png";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";
import { uploadPolaroidImage } from "../lib/uploadImage";

const ROOM_ID = "love-board-2026";
const MIN_STAGE_HEIGHT = 420;
const ROPE_Y = 52;
const DRAG_SYNC_THROTTLE_MS = 350;
const LOCAL_STORAGE_DEBOUNCE_MS = 900;
const CLIENT_ID_STORAGE_KEY = `cozy_client_id_${ROOM_ID}`;
const HANGING_MODE_STORAGE_KEY = `cozy_hanging_mode_${ROOM_ID}`;
const ROPE_POINTS_STORAGE_KEY = `cozy_rope_points_${ROOM_ID}`;

const randomInRange = (min, max) => Math.random() * (max - min) + min;

function toNumber(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function normalizeItem(row) {
  return {
    id: row.id,
    room_id: row.room_id,
    image_url: row.image_url,
    x: toNumber(row.x),
    y: toNumber(row.y),
    w: toNumber(row.w, 214),
    h: toNumber(row.h, 302),
    rotation: toNumber(row.rotation),
    text: row.text ?? "",
    z_index: Number.isInteger(row.z_index) ? row.z_index : toNumber(row.z_index),
    rev: Number.isInteger(row.rev) ? row.rev : toNumber(row.rev),
    updated_by: row.updated_by ?? "",
    updated_at: row.updated_at,
  };
}

function sortByLayer(items) {
  return [...items].sort((a, b) => {
    if (a.z_index === b.z_index) {
      return String(a.updated_at ?? "").localeCompare(String(b.updated_at ?? ""));
    }
    return a.z_index - b.z_index;
  });
}

function upsertItem(list, item) {
  const index = list.findIndex((entry) => entry.id === item.id);
  if (index === -1) return sortByLayer([...list, item]);

  const next = [...list];
  next[index] = { ...next[index], ...item };
  return sortByLayer(next);
}

function createItemFromImageUrl({ imageUrl, itemId, boardWidth, boardHeight, hangingMode, zIndex, clientId }) {
  const width = 214;
  const height = 302;

  return {
    id: itemId,
    room_id: ROOM_ID,
    image_url: imageUrl,
    x: Math.max(20, randomInRange(26, Math.max(32, boardWidth - width - 28))),
    y: hangingMode ? ROPE_Y + 18 : randomInRange(120, Math.max(140, boardHeight - height - 24)),
    w: width,
    h: height,
    rotation: randomInRange(-5, 5),
    text: "",
    z_index: zIndex,
    rev: 1,
    updated_by: clientId,
    updated_at: new Date().toISOString(),
  };
}

function getOrCreateClientId() {
  if (typeof window === "undefined") return crypto.randomUUID();

  const stored = window.localStorage.getItem(CLIENT_ID_STORAGE_KEY);
  if (stored) return stored;

  const next = crypto.randomUUID();
  window.localStorage.setItem(CLIENT_ID_STORAGE_KEY, next);
  return next;
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 16V5" />
      <path d="m7 10 5-5 5 5" />
      <path d="M4 18v1a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1" />
    </svg>
  );
}

function ExportIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3v11" />
      <path d="m17 9-5 5-5-5" />
      <rect x="4" y="16" width="16" height="5" rx="1.5" />
    </svg>
  );
}

function ModeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 8h16" />
      <path d="M6 8c0-2.8 1.8-5 6-5s6 2.2 6 5" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="15" cy="12" r="2" />
    </svg>
  );
}

function RopeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 7c3 0 3 2 6 2s3-2 6-2 3 2 4 2" />
      <path d="M9 9v9" />
      <path d="M15 9v9" />
      <path d="M9 18c0 1.2 1 2 2.2 2h1.6c1.2 0 2.2-.8 2.2-2" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M7 6v14h10V6" />
      <path d="M10 10v6" />
      <path d="M14 10v6" />
    </svg>
  );
}

function EmptyIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8 text-[#b39a7f]" fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.3" />
      <path d="m6 16 4-4 3 3 2-2 3 3" />
    </svg>
  );
}

function CaptionModal({ open, value, onChange, onClose, onSave }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#2f1e12]/30 px-4">
      <div className="w-full max-w-md rounded-2xl border border-[#e1cfb8] bg-[#fffaf2] p-4 shadow-[0_16px_38px_rgba(60,36,20,0.18)]">
        <h2 className="font-['Playfair_Display'] text-base font-semibold text-[#4d3624]">Edit caption</h2>
        <p className="mt-1 text-xs text-[#8c7967]">This updates instantly for everyone on the board.</p>

        <textarea
          autoFocus
          maxLength={180}
          rows={4}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="mt-3 w-full resize-none rounded-xl border border-[#dbc5ab] bg-[#fdf7ef] px-3 py-2 text-sm text-[#5f4836] outline-none ring-[#cfb79c] placeholder:text-[#b39a83] focus:ring"
          placeholder="Write something..."
        />

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#d7c0a6] bg-[#fffaf2] px-3 py-2 text-sm font-medium text-[#6c5441] hover:bg-[#f9efdf]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            className="rounded-lg bg-[#6f4c33] px-3 py-2 text-sm font-medium text-white hover:bg-[#5f402a]"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PolaroidBoard() {
  const [cards, setCards] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [hangingMode, setHangingMode] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(HANGING_MODE_STORAGE_KEY) === "1";
  });
  const [stageSize, setStageSize] = useState({ width: 1100, height: 680 });
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDrawingRope, setIsDrawingRope] = useState(false);
  const [ropePoints, setRopePoints] = useState(() => {
    if (typeof window === "undefined") return [];

    const raw = window.localStorage.getItem(ROPE_POINTS_STORAGE_KEY);
    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];

      const asNumbers = parsed.map((value) => Number(value)).filter((value) => Number.isFinite(value));
      return asNumbers.length >= 4 ? asNumbers : [];
    } catch {
      return [];
    }
  });
  const [captionModal, setCaptionModal] = useState({ open: false, id: "", value: "" });

  const stageRef = useRef(null);
  const containerRef = useRef(null);
  const dragSyncRef = useRef(new Map());
  const localRevRef = useRef(new Map());
  const draggingIdsRef = useRef(new Set());
  const isDraggingRef = useRef(false);
  const clientIdRef = useRef(getOrCreateClientId());
  const storageTimerRef = useRef(null);
  const storageIdleRef = useRef(null);
  const isPaintingRopeRef = useRef(false);
  const selectedIdRef = useRef(selectedId);
  const captionOpenRef = useRef(captionModal.open);
  const deleteSelectedRef = useRef(() => {});

  const boardWidth = stageSize.width;
  const boardHeight = stageSize.height;

  const scheduleLocalStoragePersist = useCallback((nextHangingMode, nextRopePoints) => {
    if (storageTimerRef.current) {
      window.clearTimeout(storageTimerRef.current);
    }
    if (storageIdleRef.current !== null && "cancelIdleCallback" in window) {
      window.cancelIdleCallback(storageIdleRef.current);
      storageIdleRef.current = null;
    }

    storageTimerRef.current = window.setTimeout(() => {
      const runPersist = () => {
        window.localStorage.setItem(HANGING_MODE_STORAGE_KEY, nextHangingMode ? "1" : "0");
        if (nextRopePoints.length < 4) {
          window.localStorage.removeItem(ROPE_POINTS_STORAGE_KEY);
        } else {
          window.localStorage.setItem(ROPE_POINTS_STORAGE_KEY, JSON.stringify(nextRopePoints));
        }
      };

      if ("requestIdleCallback" in window) {
        storageIdleRef.current = window.requestIdleCallback(() => {
          runPersist();
          storageIdleRef.current = null;
        });
      } else {
        runPersist();
      }
    }, LOCAL_STORAGE_DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    scheduleLocalStoragePersist(hangingMode, ropePoints);
  }, [hangingMode, ropePoints, scheduleLocalStoragePersist]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    captionOpenRef.current = captionModal.open;
  }, [captionModal.open]);

  useEffect(() => {
    return () => {
      if (storageTimerRef.current) {
        window.clearTimeout(storageTimerRef.current);
      }
      if (storageIdleRef.current !== null && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(storageIdleRef.current);
      }
    };
  }, []);

  const gridLines = useMemo(() => {
    const gap = 36;
    const vertical = [];
    const horizontal = [];

    for (let x = 0; x <= boardWidth; x += gap) {
      vertical.push([x, 0, x, boardHeight]);
    }

    for (let y = 0; y <= boardHeight; y += gap) {
      horizontal.push([0, y, boardWidth, y]);
    }

    return { vertical, horizontal };
  }, [boardWidth, boardHeight]);

  const clearDragSyncForItem = useCallback((itemId) => {
    const entry = dragSyncRef.current.get(itemId);
    if (!entry) return;
    window.clearTimeout(entry.timerId);
    dragSyncRef.current.delete(itemId);
  }, []);

  const nextRevisionPatch = useCallback((itemId, patch) => {
    const currentRev = localRevRef.current.get(itemId) ?? 0;
    const nextRev = currentRev + 1;
    localRevRef.current.set(itemId, nextRev);
    return {
      ...patch,
      rev: nextRev,
      updated_by: clientIdRef.current,
    };
  }, []);

  const persistItemUpdate = useCallback(async (itemId, patch) => {
    if (!supabase) return;

    const payload = {
      ...patch,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("items").update(payload).eq("id", itemId).eq("room_id", ROOM_ID);

    if (error) {
      console.error("Failed to update item", error);
    }
  }, []);

  const syncItemChange = useCallback((itemId, patch) => {
    const patchWithMeta = nextRevisionPatch(itemId, patch);
    setCards((prev) => sortByLayer(prev.map((card) => (card.id === itemId ? { ...card, ...patchWithMeta } : card))));
    clearDragSyncForItem(itemId);
    persistItemUpdate(itemId, patchWithMeta);
  }, [clearDragSyncForItem, nextRevisionPatch, persistItemUpdate]);

  useEffect(() => {
    if (!containerRef.current) return;

    const updateStageSize = () => {
      const container = containerRef.current;
      if (!container) return;

      const styles = window.getComputedStyle(container);
      const horizontalPadding = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
      const verticalPadding = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);

      setStageSize({
        width: Math.max(360, Math.floor(container.clientWidth - horizontalPadding)),
        height: Math.max(MIN_STAGE_HEIGHT, Math.floor(container.clientHeight - verticalPadding)),
      });
    };

    updateStageSize();

    const observer = new ResizeObserver(() => updateStageSize());
    observer.observe(containerRef.current);
    window.addEventListener("resize", updateStageSize);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateStageSize);
    };
  }, []);

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const loadItems = async () => {
      const { data, error } = await supabase
        .from("items")
        .select("*")
        .eq("room_id", ROOM_ID)
        .order("z_index", { ascending: true });

      if (error) {
        console.error("Failed to fetch items", error);
      }

      if (isMounted && data) {
        const normalized = sortByLayer(data.map(normalizeItem));
        const revMap = new Map();
        normalized.forEach((item) => revMap.set(item.id, item.rev ?? 0));
        localRevRef.current = revMap;
        setCards(normalized);
      }

      if (isMounted) {
        setIsLoading(false);
      }
    };

    loadItems();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!supabase) return;

    const dragSyncMap = dragSyncRef.current;
    const channel = supabase
      .channel(`room:${ROOM_ID}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "items", filter: `room_id=eq.${ROOM_ID}` },
        (payload) => {
          if (isDraggingRef.current) return;

          if (payload.eventType === "DELETE") {
            localRevRef.current.delete(payload.old.id);
            draggingIdsRef.current.delete(payload.old.id);
            setCards((prev) => prev.filter((item) => item.id !== payload.old.id));
            return;
          }

          const incoming = normalizeItem(payload.new);
          if (draggingIdsRef.current.has(incoming.id)) return;
          if (incoming.updated_by && incoming.updated_by === clientIdRef.current) return;

          const localRev = localRevRef.current.get(incoming.id) ?? 0;
          const incomingRev = incoming.rev ?? 0;
          if (incomingRev <= localRev) return;

          localRevRef.current.set(incoming.id, incomingRev);
          setCards((prev) => upsertItem(prev, incoming));
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
      dragSyncMap.forEach((entry) => {
        if (entry?.timerId) window.clearTimeout(entry.timerId);
      });
      dragSyncMap.clear();
    };
  }, []);

  const getNextZIndex = () => {
    if (cards.length === 0) return 1;
    return Math.max(...cards.map((item) => item.z_index ?? 0)) + 1;
  };

  const bringToFront = useCallback((itemId, persist = false) => {
    let nextZ = null;

    setCards((prev) => {
      const target = prev.find((item) => item.id === itemId);
      if (!target) return prev;

      nextZ = Math.max(...prev.map((item) => item.z_index ?? 0)) + 1;
      return sortByLayer(prev.map((item) => (item.id === itemId ? { ...item, z_index: nextZ } : item)));
    });

    if (persist && nextZ !== null) {
      syncItemChange(itemId, { z_index: nextZ });
    }
  }, [syncItemChange]);

  const handleSelect = useCallback((itemId) => {
    setSelectedId(itemId);
    bringToFront(itemId, true);
  }, [bringToFront]);

  const handleCardHover = useCallback((itemId) => {
    bringToFront(itemId, false);
  }, [bringToFront]);

  const handleCardDragSync = useCallback(() => {
    // Hotfix: avoid mid-drag remote writes that can race and overwrite final position.
    // Position is committed on dragEnd/transformEnd via syncItemChange.
  }, []);

  const handleCardDragStart = useCallback((itemId) => {
    draggingIdsRef.current.add(itemId);
    isDraggingRef.current = true;
  }, []);

  const handleCardDragEnd = useCallback((itemId) => {
    draggingIdsRef.current.delete(itemId);
    isDraggingRef.current = draggingIdsRef.current.size > 0;
  }, []);

  const handleCardDragStateChange = useCallback((isDragging) => {
    isDraggingRef.current = Boolean(isDragging);
  }, []);

  const handleEditText = useCallback((itemId) => {
    const card = cards.find((item) => item.id === itemId);
    if (!card) return;

    setCaptionModal({ open: true, id: itemId, value: card.text || "" });
  }, [cards]);

  const handleSaveCaption = () => {
    if (!captionModal.id) return;

    syncItemChange(captionModal.id, { text: captionModal.value.trim() });
    setCaptionModal({ open: false, id: "", value: "" });
  };

  const handleUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    if (!supabase) return;

    setIsUploading(true);

    try {
      for (const file of files) {
        const itemId = crypto.randomUUID();
        const imageUrl = await uploadPolaroidImage({ roomId: ROOM_ID, itemId, file });
        const row = createItemFromImageUrl({
          imageUrl,
          itemId,
          boardWidth,
          boardHeight,
          hangingMode,
          zIndex: getNextZIndex(),
          clientId: clientIdRef.current,
        });
        localRevRef.current.set(row.id, row.rev ?? 0);
        setCards((prev) => upsertItem(prev, row));

        const { error } = await supabase.from("items").insert(row);
        if (error) {
          console.error("Failed to insert item", error);
          localRevRef.current.delete(row.id);
          setCards((prev) => prev.filter((item) => item.id !== row.id));
        }
      }
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  const handleDeleteSelected = useCallback(async () => {
    if (!selectedId || !supabase || isDeleting) return;

    setIsDeleting(true);
    clearDragSyncForItem(selectedId);

    const { error: deleteRowError } = await supabase
      .from("items")
      .delete()
      .eq("id", selectedId)
      .eq("room_id", ROOM_ID);

    if (deleteRowError) {
      console.error("Failed to delete item", deleteRowError);
      setIsDeleting(false);
      return;
    }

    setCards((prev) => prev.filter((item) => item.id !== selectedId));
    setSelectedId(null);

    const { error: deleteFileError } = await supabase
      .storage
      .from("polaroids")
      .remove([`${ROOM_ID}/${selectedId}.jpg`]);

    if (deleteFileError) {
      console.error("Failed to delete image file", deleteFileError);
    }

    setIsDeleting(false);
  }, [selectedId, isDeleting, clearDragSyncForItem]);

  useEffect(() => {
    deleteSelectedRef.current = handleDeleteSelected;
  }, [handleDeleteSelected]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (target.isContentEditable || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
          return;
        }
      }

      const isShortcut = event.ctrlKey || event.metaKey;
      if (isShortcut && (event.key === "z" || event.key === "Z" || event.key === "y" || event.key === "Y")) {
        event.preventDefault();
        return;
      }

      if (event.key === "Escape") {
        if (captionOpenRef.current) {
          setCaptionModal({ open: false, id: "", value: "" });
          return;
        }
        if (selectedIdRef.current) {
          setSelectedId(null);
        }
        return;
      }

      if ((event.key === "Delete" || event.key === "Backspace") && selectedIdRef.current && !captionOpenRef.current) {
        event.preventDefault();
        deleteSelectedRef.current();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleExport = () => {
    const uri = stageRef.current?.toDataURL({ pixelRatio: 2 });
    if (!uri) return;

    const anchor = document.createElement("a");
    anchor.download = `polaroid-board-${Date.now()}.png`;
    anchor.href = uri;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  };

  const handleStageMouseDown = (event) => {
    if (hangingMode && isDrawingRope && event.target === event.target.getStage()) {
      const pointer = event.target.getStage()?.getPointerPosition();
      if (!pointer) return;

      isPaintingRopeRef.current = true;
      setRopePoints([pointer.x, pointer.y]);
      return;
    }

    if (event.target === event.target.getStage()) {
      setSelectedId(null);
    }
  };

  const handleStageMouseMove = (event) => {
    if (!isPaintingRopeRef.current) return;

    const pointer = event.target.getStage()?.getPointerPosition();
    if (!pointer) return;

    setRopePoints((prev) => [...prev, pointer.x, pointer.y]);
  };

  const handleStageMouseUp = () => {
    if (!isPaintingRopeRef.current) return;
    isPaintingRopeRef.current = false;
  };

  const toggleMode = () => {
    setHangingMode((prev) => !prev);
    setIsDrawingRope(false);
  };

  return (
    <section className="cozy-noise relative flex h-full w-full flex-col overflow-hidden bg-transparent">
      <div className="relative z-[1] flex h-full w-full min-h-0 flex-col gap-3 px-2 pb-20 pt-2 sm:px-3 md:pb-3">
        {!isSupabaseConfigured ? (
          <div className="rounded-xl border border-[#e5d2ba] bg-[#fff4e8] px-3 py-2 text-xs text-[#876b52]">
            Missing Supabase env. Create `.env` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then restart `npm run dev`.
          </div>
        ) : null}

        <div className="hidden rounded-2xl border border-[#e1cfb8] bg-[#fffaf2]/92 p-3 shadow-[0_14px_32px_rgba(83,55,35,0.12)] backdrop-blur-xl md:block">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#6f4c33] px-3.5 py-2 text-sm font-medium text-white shadow-[0_8px_16px_rgba(66,42,25,0.22)] transition hover:bg-[#62432d] active:translate-y-[1px]">
                <UploadIcon />
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleUpload}
                  disabled={isUploading || !isSupabaseConfigured}
                />
                {isUploading ? "Uploading..." : "Upload"}
              </label>

              <button
                type="button"
                onClick={toggleMode}
                className="inline-flex items-center gap-2 rounded-xl border border-[#d9c4aa] bg-[#fffaf2] px-3.5 py-2 text-sm font-medium text-[#6e5643] transition hover:bg-[#f9efdf] active:translate-y-[1px]"
              >
                <ModeIcon />
                {hangingMode ? "Hanging Mode" : "Normal Mode"}
              </button>

              <button
                type="button"
                onClick={handleExport}
                className="inline-flex items-center gap-2 rounded-xl border border-[#d9c4aa] bg-[#fffaf2] px-3.5 py-2 text-sm font-medium text-[#6e5643] transition hover:bg-[#f9efdf] active:translate-y-[1px]"
              >
                <ExportIcon />
                Export PNG
              </button>

              <button
                type="button"
                onClick={() => setIsDrawingRope((prev) => !prev)}
                disabled={!hangingMode}
                className="inline-flex items-center gap-2 rounded-xl border border-[#d9c4aa] bg-[#fffaf2] px-3.5 py-2 text-sm font-medium text-[#6e5643] transition hover:bg-[#f9efdf] active:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RopeIcon />
                {isDrawingRope ? "Stop Rope Draw" : "Draw Rope"}
              </button>

              <button
                type="button"
                onClick={handleDeleteSelected}
                disabled={!selectedId || isDeleting}
                className="inline-flex items-center gap-2 rounded-xl border border-[#e2c8b2] bg-[#fff4ea] px-3.5 py-2 text-sm font-medium text-[#96684a] transition hover:bg-[#fae8d9] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <DeleteIcon />
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>

            <p className="text-xs text-[#8e7a67]">
              {isDrawingRope ? "Drag on empty canvas to draw rope" : "Live sync enabled"}
            </p>
          </div>
        </div>

        <div
          ref={containerRef}
          className="workspace-card relative flex-1 min-h-0 overflow-hidden rounded-3xl border border-[#e0ccb2] bg-transparent p-3 shadow-[0_24px_56px_rgba(87,56,32,0.14)] backdrop-blur-[1px]"
        >
          <Stage
            ref={stageRef}
            width={boardWidth}
            height={boardHeight}
            onMouseDown={handleStageMouseDown}
            onMouseMove={handleStageMouseMove}
            onMouseUp={handleStageMouseUp}
            onTouchStart={handleStageMouseDown}
            onTouchMove={handleStageMouseMove}
            onTouchEnd={handleStageMouseUp}
            className="rounded-2xl"
          >
            <Layer>
              <Rect x={0} y={0} width={boardWidth} height={boardHeight} fill="rgba(255,255,255,0)" listening={false} />

              {gridLines.vertical.map((points, index) => (
                <Line
                  key={`v-${index}`}
                  points={points}
                  stroke="#6f4c33"
                  strokeWidth={1}
                  opacity={0.022}
                  listening={false}
                />
              ))}

              {gridLines.horizontal.map((points, index) => (
                <Line
                  key={`h-${index}`}
                  points={points}
                  stroke="#6f4c33"
                  strokeWidth={1}
                  opacity={0.022}
                  listening={false}
                />
              ))}

              {hangingMode && ropePoints.length >= 4 ? (
                <Line
                  points={ropePoints}
                  stroke="#b59a80"
                  strokeWidth={3}
                  lineCap="round"
                  lineJoin="round"
                  tension={0.32}
                  listening={false}
                />
              ) : null}
            </Layer>

            <Layer>
              {cards.map((card) => (
                <PolaroidCard
                  key={card.id}
                  card={card}
                  isSelected={selectedId === card.id}
                  onSelect={handleSelect}
                  onHover={handleCardHover}
                  onChange={syncItemChange}
                  onDragSync={handleCardDragSync}
                  onDragStart={handleCardDragStart}
                  onDragEnd={handleCardDragEnd}
                  onDragStateChange={handleCardDragStateChange}
                  onEditText={handleEditText}
                  hangingMode={hangingMode}
                  clipSrc={clipSrc}
                />
              ))}
            </Layer>
          </Stage>

          {!isLoading && cards.length === 0 ? (
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="rounded-2xl border border-dashed border-[#dac4aa] bg-[#fff9f0]/90 px-6 py-5 text-center shadow-sm backdrop-blur">
                <div className="mb-2 flex justify-center">
                  <EmptyIcon />
                </div>
                <p className="font-['Playfair_Display'] text-sm font-semibold text-[#5a4331]">Upload images to start</p>
                <p className="mt-1 text-xs text-[#8f7a67]">
                  {isSupabaseConfigured ? "Everything here syncs live" : "Configure Supabase env to enable live sync"}
                </p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="hidden rounded-xl border border-[#e4d1bb] bg-[#fff9f0]/85 px-4 py-2 text-xs text-[#8c7763] backdrop-blur md:block">
          {cards.length} items • Drag to move • Double click to edit caption
        </div>
      </div>

      <div className="fixed inset-x-3 bottom-3 z-30 rounded-2xl border border-[#e1cfb8] bg-[#fff9f0]/95 p-2 shadow-[0_14px_36px_rgba(80,53,33,0.2)] backdrop-blur md:hidden">
        <div className="flex items-center justify-between gap-2">
          <label className="inline-flex min-w-0 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#6f4c33] px-3 py-2 text-sm font-medium text-white">
            <UploadIcon />
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleUpload}
              disabled={isUploading || !isSupabaseConfigured}
            />
            <span className="truncate">{isUploading ? "Uploading..." : "Upload"}</span>
          </label>

          <button
            type="button"
            onClick={toggleMode}
            className="inline-flex items-center justify-center rounded-xl border border-[#d9c4aa] bg-[#fffaf2] px-3 py-2 text-[#6f5843]"
          >
            <ModeIcon />
          </button>

          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center justify-center rounded-xl border border-[#d9c4aa] bg-[#fffaf2] px-3 py-2 text-[#6f5843]"
          >
            <ExportIcon />
          </button>

          <button
            type="button"
            onClick={() => setIsDrawingRope((prev) => !prev)}
            disabled={!hangingMode}
            className="inline-flex items-center justify-center rounded-xl border border-[#d9c4aa] bg-[#fffaf2] px-3 py-2 text-[#6f5843] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RopeIcon />
          </button>

          <button
            type="button"
            onClick={handleDeleteSelected}
            disabled={!selectedId || isDeleting}
            className="inline-flex items-center justify-center rounded-xl border border-[#e2c8b2] bg-[#fff4ea] px-3 py-2 text-[#96684a] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <DeleteIcon />
          </button>
        </div>
      </div>

      <CaptionModal
        open={captionModal.open}
        value={captionModal.value}
        onChange={(value) => setCaptionModal((prev) => ({ ...prev, value }))}
        onClose={() => setCaptionModal({ open: false, id: "", value: "" })}
        onSave={handleSaveCaption}
      />
    </section>
  );
}

