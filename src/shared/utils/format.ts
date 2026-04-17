export const formatKey = (key: string | undefined): string => {
  if (!key) throw new Error("RSA Keys are missing in .env");

  // Nếu trong env bạn dùng \n (dạng chuỗi), hàm này sẽ convert thành xuống dòng thật
  // Nếu bạn đã xuống dòng thật trong env, hàm này giữ nguyên
  return key.replace(/\\n/g, "\n");
};
