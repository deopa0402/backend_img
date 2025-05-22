import express from 'express';
import multer from 'multer';
import { ImageController } from '../controllers/imageController.js';
import { TrackController } from '../controllers/trackController.js';

const router = express.Router();

// Multer 설정
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

// 이미지 업로드
router.post('/upload', upload.single('file'), ImageController.uploadImage);

// 단축 URL 생성
router.post('/shorten', ImageController.createShortUrl);

// 이미지 추적
router.get('/track', TrackController.trackImage);

// 단축 URL 처리
router.get('/:shortId', ImageController.handleShortUrl);

export default router; 