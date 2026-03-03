import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Group, Image as KonvaImage, Rect, Text, Transformer } from "react-konva";

const FRAME_PADDING = 12;
const BOTTOM_RATIO = 0.3;
const CLIP_WIDTH = 28;
const CLIP_HEIGHT = 18;

function useKonvaImage(src) {
  const [image, setImage] = useState(null);

  useEffect(() => {
    if (!src) return;

    const nextImage = new window.Image();
    nextImage.crossOrigin = "anonymous";
    nextImage.src = src;

    nextImage.onload = () => {
      setImage(nextImage);
    };

    return () => {
      nextImage.onload = null;
    };
  }, [src]);

  return src ? image : null;
}

function PolaroidCard({
  card,
  isSelected,
  onSelect,
  onHover,
  onEditText,
  onChange,
  onDragSync,
  onDragStart,
  onDragEnd,
  onDragStateChange,
  hangingMode,
  clipSrc,
  stageWidth,
  stageHeight,
}) {
  const [isHovered, setIsHovered] = useState(false);

  const groupRef = useRef(null);
  const trRef = useRef(null);
  const livePositionRef = useRef({ x: card.x, y: card.y });

  const photoImage = useKonvaImage(card.image_url);
  const clipImage = useKonvaImage(clipSrc);

  const innerWidth = useMemo(() => Math.max(40, card.w - FRAME_PADDING * 2), [card.w]);
  const bottomHeight = useMemo(() => Math.max(54, card.h * BOTTOM_RATIO), [card.h]);
  const photoAreaHeight = useMemo(
    () => Math.max(40, card.h - bottomHeight - FRAME_PADDING * 1.5),
    [card.h, bottomHeight]
  );
  const photoSize = useMemo(() => Math.max(40, Math.min(innerWidth, photoAreaHeight)), [innerWidth, photoAreaHeight]);

  const photoCrop = useMemo(() => {
    if (!photoImage) return undefined;

    const imageAspect = photoImage.width / photoImage.height;
    if (imageAspect > 1) {
      const cropWidth = photoImage.height;
      const cropX = (photoImage.width - cropWidth) / 2;
      return { x: cropX, y: 0, width: cropWidth, height: photoImage.height };
    }

    const cropHeight = photoImage.width;
    const cropY = (photoImage.height - cropHeight) / 2;
    return { x: 0, y: cropY, width: photoImage.width, height: cropHeight };
  }, [photoImage]);

  const captionTilt = useMemo(() => {
    const seed = Array.from(String(card.id)).reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return -(2 + (seed % 3));
  }, [card.id]);

  useEffect(() => {
    if (!isSelected || !trRef.current || !groupRef.current) return;

    trRef.current.nodes([groupRef.current]);
    trRef.current.getLayer()?.batchDraw();
  }, [isSelected]);

  useEffect(() => {
    livePositionRef.current = { x: card.x, y: card.y };
  }, [card.x, card.y]);

  const updateFromNode = (node, persistMode) => {
    onChange(card.id, {
      x: node.x(),
      y: node.y(),
      w: node.width(),
      h: node.height(),
      rotation: node.rotation(),
    }, persistMode);
  };

  const handleDragMove = (event) => {
    const node = event.target;
    livePositionRef.current = { x: node.x(), y: node.y() };
    onDragSync(card.id, { x: node.x(), y: node.y() });
  };

  const handleDragEnd = (event) => {
    livePositionRef.current = { x: event.target.x(), y: event.target.y() };
    updateFromNode(event.target, "immediate");
  };

  const handleTransformEnd = () => {
    const node = groupRef.current;
    if (!node) return;

    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    node.scaleX(1);
    node.scaleY(1);

    node.width(Math.max(110, node.width() * scaleX));
    node.height(Math.max(170, node.height() * scaleY));

    updateFromNode(node, "immediate");
  };

  return (
    <>
      <Group
        ref={groupRef}
        name="polaroid-card"
        x={card.x}
        y={card.y}
        width={card.w}
        height={card.h}
        rotation={card.rotation}
        draggable
        dragBoundFunc={(pos) => {
          const maxX = Math.max(0, stageWidth - card.w);
          const maxY = Math.max(0, stageHeight - card.h);
          return {
            x: Math.min(Math.max(0, pos.x), maxX),
            y: Math.min(Math.max(0, pos.y), maxY),
          };
        }}
        onClick={() => onSelect(card.id)}
        onTap={() => onSelect(card.id)}
        onDblClick={() => onEditText(card.id)}
        onDblTap={() => onEditText(card.id)}
        onMouseEnter={() => {
          setIsHovered(true);
          onHover(card.id);
          document.body.style.cursor = "grab";
        }}
        onMouseLeave={() => {
          setIsHovered(false);
          document.body.style.cursor = "default";
        }}
        onDragStart={() => {
          onDragStateChange?.(true);
          onDragStart(card.id);
          document.body.style.cursor = "grabbing";
        }}
        onDragMove={handleDragMove}
        onDragEnd={(event) => {
          document.body.style.cursor = "grab";
          handleDragEnd(event);
          onDragEnd(card.id);
          onDragStateChange?.(false);
        }}
        onTransformEnd={handleTransformEnd}
      >
        <Rect
          width={card.w}
          height={card.h}
          fill="#3d2718"
          opacity={0.04}
          cornerRadius={12}
          x={0}
          y={isHovered ? 11 : 10}
          shadowColor="rgba(90,60,30,0.35)"
          shadowBlur={isHovered ? 44 : 40}
          shadowOpacity={isHovered ? 0.46 : 0.4}
          shadowOffset={{ x: 0, y: isHovered ? 24 : 22 }}
          listening={false}
        />

        <Rect
          width={card.w}
          height={card.h}
          fill="#6f4a31"
          opacity={0.05}
          cornerRadius={12}
          x={0}
          y={isHovered ? 5 : 4}
          shadowColor="#5f402a"
          shadowBlur={isHovered ? 14 : 10}
          shadowOpacity={isHovered ? 0.13 : 0.09}
          shadowOffsetY={isHovered ? 7 : 5}
          listening={false}
        />

        <Rect
          width={card.w}
          height={card.h}
          fill="#fffdf7"
          fillLinearGradientStartPoint={{ x: 0, y: 0 }}
          fillLinearGradientEndPoint={{ x: card.w, y: card.h }}
          fillLinearGradientColorStops={[0, "#fffef9", 0.45, "#fffdf7", 1, "#f6efe5"]}
          stroke="rgba(118,86,57,0.2)"
          strokeWidth={1}
          cornerRadius={12}
        />

        {isSelected ? (
          <Rect
            width={card.w}
            height={card.h}
            stroke="#c7ad8f"
            strokeWidth={1.4}
            cornerRadius={12}
            shadowColor="#d8bea2"
            shadowBlur={18}
            shadowOpacity={0.35}
            listening={false}
          />
        ) : null}

        <KonvaImage
          image={photoImage}
          x={FRAME_PADDING}
          y={FRAME_PADDING}
          crop={photoCrop}
          width={photoSize}
          height={photoSize}
          cornerRadius={7}
        />

        <Text
          x={FRAME_PADDING + 6}
          y={card.h - bottomHeight + 12}
          width={Math.max(40, innerWidth - 12)}
          height={Math.max(34, bottomHeight - 20)}
          text={card.text || "add caption"}
          align="center"
          verticalAlign="middle"
          rotation={captionTilt}
          fill={card.text ? "#7A6652" : "#b4a08d"}
          fontSize={15}
          letterSpacing={0.45}
          fontFamily={'"Patrick Hand", "Caveat", "Itim", "Sarabun", sans-serif'}
          listening={false}
        />

        {hangingMode && clipImage ? (
          <KonvaImage
            image={clipImage}
            x={card.w / 2 - CLIP_WIDTH / 2}
            y={-6}
            width={CLIP_WIDTH}
            height={CLIP_HEIGHT}
            listening={false}
          />
        ) : null}
      </Group>

      {isSelected ? (
        <Transformer
          ref={trRef}
          rotateEnabled
          ignoreStroke
          keepRatio={false}
          anchorStroke="#bfa688"
          anchorFill="#ffffff"
          borderStroke="#bfa688"
          borderDash={[4, 4]}
          enabledAnchors={[
            "top-left",
            "top-right",
            "bottom-left",
            "bottom-right",
            "middle-left",
            "middle-right",
            "top-center",
            "bottom-center",
          ]}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 110 || newBox.height < 170) {
              return oldBox;
            }
            return newBox;
          }}
        />
      ) : null}
    </>
  );
}

export default memo(PolaroidCard);

