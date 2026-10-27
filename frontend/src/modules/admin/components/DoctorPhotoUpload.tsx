import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Avatar,
  Button,
  Modal,
  Slider,
  Space,
  Tooltip,
  Typography,
} from 'antd';
import {
  CameraOutlined,
  DeleteOutlined,
  RedoOutlined,
  ScissorOutlined,
  UploadOutlined,
  UserOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from '@ant-design/icons';

interface DoctorPhotoUploadProps {
  value?: string;
  onChange?: (value: string | undefined) => void;
  doctorName?: string;
}

export function DoctorPhotoUpload({
  value,
  onChange,
  doctorName,
}: DoctorPhotoUploadProps) {
  const [cropperOpen, setCropperOpen] = useState(false);
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(null);

  // Cropper transform state
  const [scale, setScale] = useState<number>(1);
  const [minScale, setMinScale] = useState<number>(0.5);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [rotation, setRotation] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mainCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const CANVAS_SIZE = 320; // 320x320 interactive canvas
  const CROP_RADIUS = 135; // Circular crop radius (270px diameter)

  // Handle local file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn file hình ảnh hợp lệ (JPG, PNG, WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setRawImageSrc(result);
      openCropper(result);
    };
    reader.readAsDataURL(file);

    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const drawCanvases = useCallback(() => {
    if (!loadedImage) return;

    const canvas = mainCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = CANVAS_SIZE;
    const h = CANVAS_SIZE;
    const cx = w / 2;
    const cy = h / 2;

    // 1. Clear background
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#141414';
    ctx.fillRect(0, 0, w, h);

    // 2. Draw image with pan, zoom, rotation
    ctx.save();
    ctx.translate(cx + pan.x, cy + pan.y);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(scale, scale);
    ctx.drawImage(
      loadedImage,
      -loadedImage.width / 2,
      -loadedImage.height / 2,
      loadedImage.width,
      loadedImage.height,
    );
    ctx.restore();

    // 3. Draw crop overlay mask (darkened outer area, clear circular window)
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.arc(cx, cy, CROP_RADIUS, 0, Math.PI * 2, true);
    ctx.fill();

    // Crop border circle
    ctx.beginPath();
    ctx.arc(cx, cy, CROP_RADIUS, 0, Math.PI * 2);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.stroke();

    // Subtle guide lines
    ctx.beginPath();
    // vertical
    ctx.moveTo(cx - CROP_RADIUS / 3, cy - CROP_RADIUS * 0.94);
    ctx.lineTo(cx - CROP_RADIUS / 3, cy + CROP_RADIUS * 0.94);
    ctx.moveTo(cx + CROP_RADIUS / 3, cy - CROP_RADIUS * 0.94);
    ctx.lineTo(cx + CROP_RADIUS / 3, cy + CROP_RADIUS * 0.94);
    // horizontal
    ctx.moveTo(cx - CROP_RADIUS * 0.94, cy - CROP_RADIUS / 3);
    ctx.lineTo(cx + CROP_RADIUS * 0.94, cy - CROP_RADIUS / 3);
    ctx.moveTo(cx - CROP_RADIUS * 0.94, cy + CROP_RADIUS / 3);
    ctx.lineTo(cx + CROP_RADIUS * 0.94, cy + CROP_RADIUS / 3);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.stroke();
    ctx.restore();

    // 4. Update small preview canvas (circle only)
    if (previewCanvasRef.current) {
      const pCanvas = previewCanvasRef.current;
      const pCtx = pCanvas.getContext('2d');
      if (pCtx) {
        const pw = pCanvas.width;
        const ph = pCanvas.height;
        pCtx.clearRect(0, 0, pw, ph);

        pCtx.save();
        pCtx.beginPath();
        pCtx.arc(pw / 2, ph / 2, pw / 2, 0, Math.PI * 2);
        pCtx.clip();

        // draw from main canvas crop circle area
        const sourceX = cx - CROP_RADIUS;
        const sourceY = cy - CROP_RADIUS;
        const sourceSize = CROP_RADIUS * 2;
        pCtx.drawImage(canvas, sourceX, sourceY, sourceSize, sourceSize, 0, 0, pw, ph);
        pCtx.restore();
      }
    }
  }, [loadedImage, scale, pan, rotation]);

  const openCropper = (imageSrc: string) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setLoadedImage(img);

      // Calculate initial scale to fit the crop area
      const diameter = CROP_RADIUS * 2;
      const baseScale = Math.max(diameter / img.width, diameter / img.height);
      const initialScale = Math.max(baseScale, 1);
      setMinScale(Math.min(baseScale, 0.5));
      setScale(initialScale);
      setPan({ x: 0, y: 0 });
      setRotation(0);
      setCropperOpen(true);
    };
    img.src = imageSrc;
  };

  // Re-draw main interactive canvas and preview canvas when parameters change
  useEffect(() => {
    if (!cropperOpen || !loadedImage) return;

    drawCanvases();
    const rafId = requestAnimationFrame(drawCanvases);
    const timer1 = setTimeout(drawCanvases, 40);
    const timer2 = setTimeout(drawCanvases, 150);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [cropperOpen, loadedImage, drawCanvases]);

  // Mouse Drag handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - pan.x,
      y: e.clientY - pan.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch Drag handlers
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      const touch = e.touches[0];
      dragStartRef.current = {
        x: touch.clientX - pan.x,
        y: touch.clientY - pan.y,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setPan({
      x: touch.clientX - dragStartRef.current.x,
      y: touch.clientY - dragStartRef.current.y,
    });
  };

  // Apply Crop and output data URL
  const handleApplyCrop = () => {
    if (!loadedImage) return;

    // Export at crisp 280x280 px
    const exportSize = 280;
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = exportSize;
    exportCanvas.height = exportSize;
    const exportCtx = exportCanvas.getContext('2d');
    if (!exportCtx) return;

    const scaleFactor = exportSize / (CROP_RADIUS * 2);

    exportCtx.save();
    // Center of export canvas
    exportCtx.translate(exportSize / 2, exportSize / 2);
    exportCtx.rotate((rotation * Math.PI) / 180);
    exportCtx.scale(scale * scaleFactor, scale * scaleFactor);
    exportCtx.translate(
      pan.x / scale,
      pan.y / scale,
    );
    exportCtx.drawImage(
      loadedImage,
      -loadedImage.width / 2,
      -loadedImage.height / 2,
      loadedImage.width,
      loadedImage.height,
    );
    exportCtx.restore();

    const dataUrl = exportCanvas.toDataURL('image/jpeg', 0.88);
    onChange?.(dataUrl);
    setCropperOpen(false);
  };

  const handleResetCrop = () => {
    if (!loadedImage) return;
    const diameter = CROP_RADIUS * 2;
    const baseScale = Math.max(diameter / loadedImage.width, diameter / loadedImage.height);
    setScale(Math.max(baseScale, 1));
    setPan({ x: 0, y: 0 });
    setRotation(0);
  };

  const handleRemovePhoto = () => {
    onChange?.(undefined);
    setRawImageSrc(null);
  };

  // Extract initial for avatar fallback
  const initial = doctorName
    ? doctorName.trim().split(/\s+/).slice(-1)[0]?.charAt(0).toUpperCase() || 'B'
    : 'B';

  const hasPhoto = Boolean(
    value &&
      !value.includes('example.test') &&
      !value.includes('example.com'),
  );

  return (
    <div
      style={{
        padding: '14px 16px',
        backgroundColor: '#fafafa',
        border: '1px dashed #d9d9d9',
        borderRadius: 8,
        marginBottom: 16,
      }}
    >
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/png, image/jpeg, image/webp"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* Avatar Preview Box */}
        <div style={{ position: 'relative' }}>
          <Avatar
            size={84}
            src={hasPhoto ? value : undefined}
            icon={!hasPhoto && !doctorName ? <UserOutlined /> : undefined}
            style={{
              backgroundColor: '#1677ff',
              color: '#fff',
              fontSize: 32,
              fontWeight: 700,
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              border: '2px solid #fff',
            }}
          >
            {!hasPhoto && initial}
          </Avatar>
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              backgroundColor: '#1677ff',
              color: '#fff',
              borderRadius: '50%',
              width: 26,
              height: 26,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              border: '2px solid #fff',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            }}
            title="Tải ảnh mới từ máy tính"
          >
            <CameraOutlined style={{ fontSize: 13 }} />
          </div>
        </div>

        {/* Controls */}
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
            Ảnh chân dung bác sĩ
          </div>
          <Typography.Paragraph
            type="secondary"
            style={{ fontSize: 12, margin: '0 0 10px 0', lineHeight: 1.4 }}
          >
            Tải ảnh từ máy tính (JPG, PNG, WEBP). Sau khi chọn ảnh, bạn có thể căn chỉnh khung hình, phóng to và xoay theo ý muốn.
          </Typography.Paragraph>

          <Space size={8} wrap>
            <Button
              type="primary"
              ghost
              size="small"
              icon={<UploadOutlined />}
              onClick={() => fileInputRef.current?.click()}
            >
              {hasPhoto ? 'Đổi ảnh từ máy tính' : 'Tải ảnh từ máy tính'}
            </Button>

            {hasPhoto && (
              <>
                <Button
                  size="small"
                  icon={<ScissorOutlined />}
                  onClick={() => {
                    if (rawImageSrc) {
                      openCropper(rawImageSrc);
                    } else if (value) {
                      openCropper(value);
                    }
                  }}
                >
                  Chỉnh lại khung
                </Button>

                <Button
                  danger
                  size="small"
                  type="text"
                  icon={<DeleteOutlined />}
                  onClick={handleRemovePhoto}
                >
                  Xóa ảnh
                </Button>
              </>
            )}
          </Space>
        </div>
      </div>

      {/* Interactive Crop & Frame Adjuster Modal */}
      <Modal
        title={
          <Space>
            <ScissorOutlined style={{ color: '#1677ff' }} />
            <span>Điều chỉnh khung ảnh chân dung</span>
          </Space>
        }
        open={cropperOpen}
        centered
        width={500}
        onCancel={() => setCropperOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setCropperOpen(false)}>
            Hủy
          </Button>,
          <Button key="reset" onClick={handleResetCrop}>
            Đặt lại
          </Button>,
          <Button key="apply" type="primary" onClick={handleApplyCrop}>
            Áp dụng khung hình
          </Button>,
        ]}
        forceRender
        destroyOnHidden={false}
        afterOpenChange={(open) => {
          if (open) {
            drawCanvases();
            setTimeout(drawCanvases, 40);
            setTimeout(drawCanvases, 150);
          }
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Typography.Text type="secondary" style={{ fontSize: 12, marginBottom: 10 }}>
            Kéo thả chuột để di chuyển ảnh vào giữa khung tròn. Dùng thanh trượt bên dưới để phóng to / thu nhỏ.
          </Typography.Text>

          {/* Interactive Canvas */}
          <div
            style={{
              width: CANVAS_SIZE,
              height: CANVAS_SIZE,
              borderRadius: 8,
              overflow: 'hidden',
              cursor: isDragging ? 'grabbing' : 'grab',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              userSelect: 'none',
              touchAction: 'none',
              backgroundColor: '#141414',
            }}
          >
            <canvas
              ref={mainCanvasRef}
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              style={{ display: 'block' }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleMouseUp}
            />
          </div>

          {/* Controls: Zoom slider & Rotate */}
          <div style={{ width: '100%', maxWidth: 360, marginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Tooltip title="Thu nhỏ">
                <Button
                  size="small"
                  icon={<ZoomOutOutlined />}
                  onClick={() => setScale((s) => Math.max(minScale, s - 0.1))}
                />
              </Tooltip>
              <Slider
                min={minScale}
                max={Math.max(minScale * 3.5, 3)}
                step={0.05}
                value={scale}
                onChange={(val) => setScale(val)}
                style={{ flex: 1, margin: '0 8px' }}
              />
              <Tooltip title="Phóng to">
                <Button
                  size="small"
                  icon={<ZoomInOutlined />}
                  onClick={() => setScale((s) => Math.min(Math.max(minScale * 3.5, 3), s + 0.1))}
                />
              </Tooltip>
              <Tooltip title="Xoay 90°">
                <Button
                  size="small"
                  icon={<RedoOutlined />}
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                />
              </Tooltip>
            </div>
          </div>

          {/* Live Preview row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              marginTop: 16,
              padding: '10px 16px',
              backgroundColor: '#f5f5f5',
              borderRadius: 6,
              width: '100%',
              maxWidth: 360,
              justifyContent: 'center',
            }}
          >
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Hiển thị xem trước:</span>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                overflow: 'hidden',
                border: '2px solid #1677ff',
                backgroundColor: '#fff',
              }}
            >
              <canvas
                ref={previewCanvasRef}
                width={56}
                height={56}
                style={{ width: '100%', height: '100%' }}
              />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
