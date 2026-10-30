import React from 'react';

interface HeroMotherArtProps {
  quote?: string | null;
}

/**
 * Khung minh họa nghệ thuật mái vòm mẹ bầu và trẻ thơ cho khối Hero Tâm An.
 * Tái hiện thiết kế tam-an-hero.html với hình ảnh mẹ bầu, hoa lá, mây, trái tim và huy hiệu uy tín.
 */
export const HeroMotherArt: React.FC<HeroMotherArtProps> = ({ quote }) => {
  return (
    <div className="ph-art" aria-hidden="true">
      <svg viewBox="0 0 520 580" role="img" aria-label="Minh họa mẹ bầu đặt tay lên bụng">
        {/* Vòm cổng */}
        <path d="M30 580V260A230 230 0 0 1 490 260V580Z" fill="#DCE9F8" />
        <path d="M70 580V262A190 190 0 0 1 450 262V580Z" fill="#EAF2FC" />
        <circle cx="395" cy="190" r="46" fill="#FFE0C2" />
        {/* Đám mây */}
        <g fill="#fff">
          <ellipse cx="130" cy="170" rx="38" ry="14" />
          <ellipse cx="156" cy="160" rx="26" ry="14" />
          <ellipse cx="410" cy="300" rx="30" ry="11" />
        </g>
        {/* Trái tim yêu thương */}
        <path d="M392 360c-8-12-24-2-14 10l14 13 14-13c10-12-6-22-14-10z" fill="#F4A3A3" />
        <path d="M120 300c-6-9-18-1-10 8l10 10 10-10c8-9-4-17-10-8z" fill="#F4A3A3" opacity=".8" />
        {/* Nền sàn */}
        <ellipse cx="260" cy="548" rx="200" ry="18" fill="#C6D9EF" />
        {/* Cây cảnh trái */}
        <g>
          <path d="M96 548c-6-60-30-92-50-110 28 8 50 40 56 110z" fill="#5FA37A" />
          <path d="M104 548c2-70 22-104 52-124-8 40-22 84-40 124z" fill="#3F8A63" />
          <path d="M100 548c-2-50-2-86 4-118 10 34 10 80 2 118z" fill="#7DBB92" />
        </g>
        {/* Chậu cây phải */}
        <g>
          <rect x="402" y="498" width="46" height="50" rx="8" fill="#E67E22" />
          <path d="M425 500c-30-20-40-52-34-84 22 20 34 50 34 84z" fill="#3F8A63" />
          <path d="M425 500c28-18 40-46 38-78-22 18-36 46-38 78z" fill="#5FA37A" />
          <path d="M425 500c-2-40 2-72 12-100 6 32 2 70-12 100z" fill="#7DBB92" />
        </g>
        {/* Đôi chân & giày */}
        <rect x="232" y="500" width="22" height="42" rx="10" fill="#F2C3A0" />
        <rect x="268" y="500" width="22" height="42" rx="10" fill="#F2C3A0" />
        <ellipse cx="238" cy="546" rx="22" ry="8" fill="#183153" />
        <ellipse cx="284" cy="546" rx="22" ry="8" fill="#183153" />
        {/* Váy bầu xanh navy */}
        <path d="M205 318Q262 296 318 318L338 410Q352 470 336 512Q262 528 188 512Q172 470 186 410Z" fill="#0B4F9C" />
        <ellipse cx="262" cy="432" rx="64" ry="60" fill="#1F67BD" />
        <path d="M200 500Q262 516 326 500" stroke="#1677FF" strokeWidth="4" fill="none" opacity=".6" />
        {/* Cổ */}
        <rect x="251" y="282" width="22" height="34" rx="10" fill="#E9B08A" />
        {/* Đôi tay ôm bụng */}
        <path d="M210 326Q168 392 234 446" stroke="#0B4F9C" strokeWidth="26" strokeLinecap="round" fill="none" />
        <path d="M314 326Q356 392 290 446" stroke="#0B4F9C" strokeWidth="26" strokeLinecap="round" fill="none" />
        <circle cx="240" cy="446" r="14" fill="#F2C3A0" />
        <circle cx="284" cy="446" r="14" fill="#F2C3A0" />
        {/* Khuôn mặt & mái tóc */}
        <circle cx="262" cy="196" r="22" fill="#3A2622" />
        <path d="M216 250Q212 186 262 184Q312 186 308 250Q308 288 298 296L226 296Q216 288 216 250Z" fill="#3A2622" />
        <ellipse cx="262" cy="248" rx="38" ry="42" fill="#F2C3A0" />
        <path d="M224 238Q236 206 262 206Q290 206 300 238Q280 222 262 222Q242 222 224 238Z" fill="#3A2622" />
        <path d="M243 252q6 5 12 0M269 252q6 5 12 0" stroke="#3A2622" strokeWidth="3" strokeLinecap="round" fill="none" />
        <path d="M252 270q10 9 20 0" stroke="#C0564B" strokeWidth="3.5" strokeLinecap="round" fill="none" />
        <circle cx="240" cy="266" r="6" fill="#F4A3A3" opacity=".7" />
        <circle cx="284" cy="266" r="6" fill="#F4A3A3" opacity=".7" />
      </svg>

      {/* Ảnh mẹ bầu tĩnh (Fallback sang SVG nếu ảnh không có) */}
      <img
        className="ph-photo"
        src="/images/hero-mother.jpg"
        alt=""
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />

      {/* Bong bóng thông điệp */}
      {quote && <div className="ph-fact">{quote}</div>}
    </div>
  );
};

