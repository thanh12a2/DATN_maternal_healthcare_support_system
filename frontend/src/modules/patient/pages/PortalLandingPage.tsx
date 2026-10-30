import { useAuthSession } from '../../../app/AuthSessionProvider';
import { PublicPortalHeader } from '../../../shared/components/portal/PublicPortalHeader';
import { PublicPortalFooter } from '../../../shared/components/portal/PublicPortalFooter';
import { ChatbotLauncher } from '../components/chatbot/ChatbotLauncher';
import { PersonalizedHero } from '../components/PersonalizedHero';
import { PublicHero } from '../components/PublicHero';
import { WhyChooseUsSection } from '../components/WhyChooseUsSection';
import '../../../styles/portal-landing.css';

/**
 * Trang chủ Cổng bệnh nhân Bệnh viện Phụ sản Tâm An.
 * - Header 2 tầng chuẩn mực y tế
 * - Hero 2 cột: PersonalizedHero (khi đã đăng nhập) / PublicHero (khi chưa đăng nhập)
 * - Khối Tại sao nên chọn Tâm An (Vinmec style)
 * - Nút mở Chatbot AI tư vấn
 * - Footer thông tin bệnh viện
 */
export function PortalLandingPage() {
  const auth = useAuthSession();
  const isAuth = auth.status === 'authenticated' && Boolean(auth.user);

  return (
    <div className="portal-page-wrapper">
      {/* 1. Header Vinmec Style */}
      <PublicPortalHeader />

      {/* 2. Hero Section: Khối cá nhân hóa khi đã đăng nhập hoặc Khối công khai khi là khách */}
      {isAuth ? <PersonalizedHero /> : <PublicHero />}

      {/* 3. Khối Tại sao nên chọn Tâm An (Trụ cột chất lượng Vinmec Style) */}
      <WhyChooseUsSection />

      {/* 4. Floating Mascot Chatbot Launcher for Instant Patient Q&A */}
      <ChatbotLauncher />

      {/* 5. Footer Vinmec Style */}
      <PublicPortalFooter />
    </div>
  );
}
