import { TrackService } from '../services/trackService.js';

export class TrackController {
  static async trackImage(req, res) {
    try {
      const { image_url } = req.query;
      const ip = req.headers['x-forwarded-for'] || req.ip || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';
      const referrer = req.headers.referer || 'direct';
      const timestamp = new Date().toISOString();

      console.log('이미지 추적 요청:', {
        image_url,
        ip,
        userAgent,
        referrer,
        timestamp
      });

      if (!image_url || !image_url.startsWith('https://')) {
        return res.status(400).json({ error: '유효한 image_url이 필요합니다.' });
      }

      // 중복 요청 확인 및 접근 기록 저장
      const isDuplicate = await TrackService.checkDuplicateAccess(image_url, ip, userAgent, referrer);
      
      if (!isDuplicate) {
        // 접근 카운트 업데이트
        await TrackService.updateAccessCount(image_url, timestamp);
        
        // 상세 접근 기록 저장
        await TrackService.saveAccessHistory(image_url, ip, userAgent, referrer, timestamp);
      }

      // 이미지 가져오기 및 반환
      const { imageData, contentType } = await TrackService.fetchImage(image_url);
      
      res.set({
        'Content-Type': contentType,
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });

      res.send(Buffer.from(imageData));
    } catch (error) {
      console.error('이미지 추적 오류:', error);
      res.status(500).json({ error: '이미지 추적 중 오류가 발생했습니다.' });
    }
  }
} 