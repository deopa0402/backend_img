export const errorHandler = (err, req, res, next) => {
  console.error('에러 발생:', err);

  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: '파일 크기는 5MB를 초과할 수 없습니다.' });
    }
    return res.status(400).json({ error: '파일 업로드 중 오류가 발생했습니다.' });
  }

  res.status(500).json({ error: '서버 오류가 발생했습니다.' });
}; 