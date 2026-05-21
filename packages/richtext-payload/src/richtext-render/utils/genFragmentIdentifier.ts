export function genFragmentIdentifier(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD') // tách dấu ra khỏi ký tự
    .replace(/[\u0300-\u036F]/g, '') // bỏ dấu VN
    .replace(/đ/g, 'd')
    .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, '-') // quy mọi dạng gạch ngang Unicode → '-'
    .replace(/[\s\u00A0\/\\|_.,;:+=@&]+/g, '-') // khoảng trắng & dấu phân tách → '-'
    .replace(/[^a-z0-9-]/g, '') // giữ lại a-z, số, dấu '-'
    .replace(/-+/g, '-') // gộp nhiều dấu - liên tiếp bằng 1 dấu -
    .replace(/^-|-$/g, ''); // bỏ - ở đầu/cuối (nếu có)
}
