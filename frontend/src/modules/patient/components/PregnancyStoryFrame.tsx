// Local Pexels photography: Pavel Danilyuk (7055918, 7055910), MART PRODUCTION (7089337).
const chapters = [
  { photo: '7055918', range: '1–13', title: 'Tấm hình đầu tiên', description: 'Từ buổi khám đầu, mẹ bắt đầu lưu lại những hình ảnh và câu hỏi dành cho bác sĩ.', alt: 'Đôi tay mẹ nâng tấm ảnh siêu âm' },
  { photo: '7089337', range: '14–27', title: 'Gặp con qua màn hình', description: 'Đến buổi siêu âm, mẹ có dịp nhìn con rõ hơn và nghe bác sĩ giải thích từng hình ảnh.', alt: 'Bác sĩ chuẩn bị siêu âm bụng cho mẹ' },
  { photo: '7055910', range: '28–40', title: 'Chờ ngày gặp con', description: 'Bên những bộ quần áo nhỏ đã chuẩn bị, mẹ xem lại ảnh của con và sắp xếp hành trang đi sinh.', alt: 'Mẹ xem ảnh siêu âm bên những bộ quần áo của bé' },
] as const;

export function PregnancyStoryFrame({ trimester, showCaption = true, followsWeek = false }: {
  trimester: number; showCaption?: boolean; followsWeek?: boolean;
}) {
  const chapter = chapters[trimester - 1];
  return (
    <figure className="pg-story-frame">
      <div className="pg-story-images" data-photo-stop={trimester - 1}>
        {(followsWeek ? chapters : [chapter]).map(item => (
          <img key={item.photo} src={`/images/pregnancy-${item.photo}.jpg`}
            alt={item === chapter ? item.alt : ''} data-current={item === chapter}
            width="960" height="1440" decoding="async" />
        ))}
      </div>
      {showCaption && <figcaption>
        <small>Tuần {chapter.range}</small>
        <strong>{chapter.title}</strong>
        <p>{chapter.description}</p>
      </figcaption>}
    </figure>
  );
}

