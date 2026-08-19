/**
 * hashtagUtils.ts — Tiện ích phát hiện, bóc tách và render Hashtag (#tag) cho Diễn đàn.
 */

/**
 * Regex phát hiện tất cả các từ đứng sau dấu `#` (hỗ trợ tiếng Việt Unicode)
 * Ví dụ: "Học #Toán12 thấy phần #GiảiTích rất hay" → ["#Toán12", "#GiảiTích"]
 */
const HASHTAG_REGEX = /#([\w\u00C0-\u024F\u1EA0-\u1EF9]+)/g;

/**
 * Bóc tách mảng danh sách Hashtags duy nhất có trong văn bản
 */
export function extractHashtags(content: string): string[] {
  if (!content) return [];
  const matches = content.match(HASHTAG_REGEX);
  if (!matches) return [];
  // Loại bỏ các thẻ trùng lặp
  return Array.from(new Set(matches));
}

/**
 * Phân rã nội dung bài viết thành các đoạn văn bản thô & thẻ Hashtag
 * @deprecated Dùng injectHashtagSpansInHtml thay thế để tránh phá vỡ cấu trúc HTML
 */
export interface ContentPart {
  type: 'text' | 'hashtag';
  value: string;
}

export function parseContentWithHashtags(content: string): ContentPart[] {
  if (!content) return [];
  const parts: ContentPart[] = [];
  let lastIndex = 0;

  content.replace(HASHTAG_REGEX, (match, _, offset) => {
    // Đoạn text trước hashtag
    if (offset > lastIndex) {
      parts.push({ type: 'text', value: content.slice(lastIndex, offset) });
    }
    // Đoạn hashtag
    parts.push({ type: 'hashtag', value: match });
    lastIndex = offset + match.length;
    return match;
  });

  // Đoạn text còn lại sau hashtag cuối
  if (lastIndex < content.length) {
    parts.push({ type: 'text', value: content.slice(lastIndex) });
  }

  return parts;
}

/**
 * Inject thẻ <span class="forum-hashtag-pill" data-tag="..."> vào HTML string.
 *
 * Chỉ replace hashtag trong phần TEXT CONTENT (giữa các thẻ HTML), không replace
 * bên trong attribute HTML hay bên trong chính thẻ mở/đóng → không phá vỡ cấu trúc HTML.
 *
 * Cơ chế: regex `(>[^<]*)|^([^<]+)` match các đoạn text nằm sau dấu `>` hoặc đầu chuỗi
 * (nghĩa là text nằm ngoài thẻ HTML), sau đó apply HASHTAG_REGEX chỉ trên đoạn đó.
 */
export function injectHashtagSpansInHtml(html: string): string {
  if (!html) return '';
  return html.replace(/(>[^<]*)|^([^<]+)/gm, (match) => {
    return match.replace(
      HASHTAG_REGEX,
      '<span class="forum-hashtag-pill" data-tag="$1">#$1</span>'
    );
  });
}
