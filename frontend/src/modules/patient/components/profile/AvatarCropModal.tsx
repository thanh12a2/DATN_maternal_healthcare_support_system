import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { X, ZoomIn, ZoomOut, RotateCw, Check, Move } from 'lucide-react';

interface AvatarCropModalProps {
  isOpen: boolean;
  imageSrc: string | null;
  onClose: () => void;
  onSave: (croppedDataUrl: string) => void;
}

const CROP_SIZE = 220; // Đường kính khung tròn hiển thị trên UI

export const AvatarCropModal: React.FC<AvatarCropModalProps> = ({
  isOpen,
  imageSrc,
  onClose,
  onSave,
}) => {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [naturalSize, setNaturalSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const dragStartRef = useRef({ x: 0, y: 0 });
  const positionStartRef = useRef({ x: 0, y: 0 });
  const imageRef = useRef<HTMLImageElement | null>(null);

  // Lấy kích thước thật của ảnh khi mở modal
  useEffect(() => {
    if (!imageSrc || !isOpen) {
      setNaturalSize(null);
      return;
    }
    const img = new Image();
    img.onload = () => {
      setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = imageSrc;
  }, [imageSrc, isOpen]);

  // Reset các thông số về mặc định khi mở modal mới
  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setRotation(0);
      setPosition({ x: 0, y: 0 });
    }
  }, [isOpen, imageSrc]);

  // Tính toán kích thước hiển thị cơ sở để ảnh vừa vặn đẹp mắt với khung tròn (không bị zoom quá to)
  const { displayBaseWidth, displayBaseHeight } = useMemo(() => {
    if (!naturalSize)
      return { displayBaseWidth: CROP_SIZE, displayBaseHeight: CROP_SIZE };
    // Tỷ lệ bao phủ toàn bộ khung tròn 220px
    const fitScale = Math.max(
      CROP_SIZE / naturalSize.width,
      CROP_SIZE / naturalSize.height,
    );
    return {
      displayBaseWidth: Math.round(naturalSize.width * fitScale),
      displayBaseHeight: Math.round(naturalSize.height * fitScale),
    };
  }, [naturalSize]);

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    positionStartRef.current = { ...position };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPosition({
      x: positionStartRef.current.x + dx,
      y: positionStartRef.current.y + dy,
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignored
    }
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleCrop = useCallback(() => {
    if (!imageRef.current || !naturalSize) return;
    const img = imageRef.current;

    const outputSize = 320;
    const canvas = document.createElement('canvas');
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Tỷ lệ giữa canvas đầu ra (320px) và khung tròn trên UI (220px)
    const ratio = outputSize / CROP_SIZE;

    ctx.save();
    // Tô nền trắng để tránh viền trong suốt nếu người dùng thu nhỏ ảnh
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, outputSize, outputSize);
    // 1. Di chuyển tâm canvas
    ctx.translate(outputSize / 2, outputSize / 2);
    // 2. Di chuyển theo tọa độ kéo thả thực tế của người dùng
    ctx.translate(position.x * ratio, position.y * ratio);
    // 3. Xoay góc
    ctx.rotate((rotation * Math.PI) / 180);

    // 4. Kích thước vẽ tương ứng 100% kích thước người dùng nhìn thấy trên màn hình
    const drawW = displayBaseWidth * scale * ratio;
    const drawH = displayBaseHeight * scale * ratio;

    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.92);
    onSave(croppedDataUrl);
    onClose();
  }, [
    naturalSize,
    displayBaseWidth,
    displayBaseHeight,
    scale,
    position,
    rotation,
    onSave,
    onClose,
  ]);

  if (!isOpen || !imageSrc) return null;

  return (
    <div
      className="avatar-crop-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="crop-modal-title"
    >
      <div className="avatar-crop-dialog">
        <header className="avatar-crop-header">
          <div>
            <h2 id="crop-modal-title" className="avatar-crop-title">
              Chỉnh sửa khung ảnh đại diện
            </h2>
            <p className="avatar-crop-desc">
              Kéo để di chuyển vị trí và dùng thanh trượt để phóng to/thu nhỏ
              vào khung tròn.
            </p>
          </div>
          <button
            type="button"
            className="avatar-crop-btn-close"
            onClick={onClose}
            aria-label="Đóng cửa sổ"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Viewport chỉnh khung */}
        <div
          className="avatar-crop-viewport-wrap"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {/* Ảnh được căn chỉnh */}
          <div
            className="avatar-crop-image-container"
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
            }}
          >
            <img
              ref={imageRef}
              src={imageSrc}
              alt="Căn chỉnh ảnh"
              draggable={false}
              className="avatar-crop-source-img"
              style={{
                width: `${displayBaseWidth}px`,
                height: `${displayBaseHeight}px`,
                minWidth: `${displayBaseWidth}px`,
                minHeight: `${displayBaseHeight}px`,
              }}
            />
          </div>

          {/* Mặt nạ khung tròn (Mask) */}
          <div className="avatar-crop-mask" aria-hidden="true">
            <div className="avatar-crop-circle-guide" />
          </div>

          <div className="avatar-crop-drag-hint">
            <Move className="w-3.5 h-3.5" />
            <span>Kéo để di chuyển</span>
          </div>
        </div>

        {/* Bảng điều khiển thu phóng & xoay */}
        <div className="avatar-crop-controls">
          <div className="avatar-crop-zoom-group">
            <button
              type="button"
              className="avatar-control-btn"
              onClick={() =>
                setScale((s) => Math.max(0.6, +(s - 0.1).toFixed(2)))
              }
              title="Thu nhỏ"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <input
              type="range"
              min={0.6}
              max={3}
              step={0.05}
              value={scale}
              onChange={(e) => setScale(parseFloat(e.target.value))}
              className="avatar-zoom-slider"
              aria-label="Thanh trượt phóng to thu nhỏ"
            />
            <button
              type="button"
              className="avatar-control-btn"
              onClick={() =>
                setScale((s) => Math.min(3, +(s + 0.1).toFixed(2)))
              }
              title="Phóng to"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            className="avatar-rotate-btn"
            onClick={handleRotate}
            title="Xoay ảnh 90 độ"
          >
            <RotateCw className="w-4 h-4" />
            <span>Xoay 90°</span>
          </button>
        </div>

        {/* Nút hành động */}
        <footer className="avatar-crop-actions">
          <button type="button" className="btn-crop-cancel" onClick={onClose}>
            Hủy bỏ
          </button>
          <button type="button" className="btn-crop-apply" onClick={handleCrop}>
            <Check className="w-4 h-4" />
            Áp dụng &amp; Lưu ảnh
          </button>
        </footer>
      </div>
    </div>
  );
};
