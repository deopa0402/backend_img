import { ImageService } from '../services/imageService.js';
import { TrackService } from '../services/trackService.js';

// 중복 요청 필터링 시간(초)
const DUPLICATE_FILTER_SECONDS = 3;

export class ImageController {
  static async uploadImage(req, res) {
    try {
      console.log('이미지 업로드 요청:', {
        file: req.file ? {
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size
        } : null
      });

      if (!req.file) {
        return res.status(400).json({ error: '파일이 없습니다.' });
      }

      const imageUrl = await ImageService.uploadImage(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );

      console.log('이미지 업로드 성공:', { imageUrl });
      res.json({ imageUrl });
    } catch (error) {
      console.error('업로드 오류:', error);
      res.status(500).json({ error: '이미지 업로드 중 오류가 발생했습니다.' });
    }
  }

  static async createShortUrl(req, res) {
    try {
      console.log('단축 URL 생성 요청:', {
        image_url: req.body.image_url
      });

      const { image_url } = req.body;
      console.log('image_url:', { image_url });
      const shortId = await ImageService.createShortUrl(image_url);
      
      console.log('shortId:', { shortId });
      const shortUrl = `${process.env.BACKEND_URL}/api/${shortId}`;

      console.log('단축 URL 생성 성공:', { shortUrl });
      res.json({ short_url: shortUrl });
    } catch (error) {
      console.error('단축 URL 생성 오류:', error);
      if (error.message === '유효한 image_url이 필요합니다') {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: '단축 URL 생성 중 오류가 발생했습니다.' });
    }
  }

  static async handleShortUrl(req, res) {
    try {
      console.log('단축 URL 처리 요청:', {
        shortId: req.params.shortId
      });

      const { shortId } = req.params;
      const originalUrl = await ImageService.getOriginalUrl(shortId);
      
      console.log('단축 URL 처리 성공:', {
        shortId,
        originalUrl
      });

      // 이미지 가져오기 및 반환
      const { imageData, contentType } = await TrackService.fetchImage(originalUrl);
      
      // 접근 정보 수집
      const ip = req.headers['x-forwarded-for'] || req.ip || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';
      const referrer = req.headers.referer || 'direct';
      const timestamp = new Date().toISOString();

      // 중복 요청 확인 및 접근 기록 저장
      const isDuplicate = await TrackService.checkDuplicateAccess(originalUrl, ip, userAgent, referrer);
      
      if (!isDuplicate) {
        // 접근 카운트 업데이트
        await TrackService.updateAccessCount(originalUrl, timestamp);
        
        // 상세 접근 기록 저장
        await TrackService.saveAccessHistory(originalUrl, ip, userAgent, referrer, timestamp);
      }

      res.set({
        'Content-Type': contentType,
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });

      res.send(Buffer.from(imageData));
    } catch (error) {
      console.error('단축 URL 처리 오류:', error);
      res.status(404).json({ error: '이미지를 찾을 수 없습니다.' });
    }
  }
} 