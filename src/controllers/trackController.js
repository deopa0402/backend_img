import { TrackService } from '../services/trackService.js';

export class TrackController {
  static async trackImage(req, res) {
    try {
      const { short_id } = req.params;
      const ip = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'] || 'unknown';
      const referrer = req.headers.referer || 'direct';

      // 단축 URL로부터 원본 URL 가져오기
      const originalUrl = await TrackService.getOriginalUrl(short_id);
      
      // 이미지 트래킹 및 반환
      const result = await TrackService.trackImageView(originalUrl, ip, userAgent, referrer);
      
      // 이미지 반환
      res.set('Content-Type', result.contentType);
      res.send(Buffer.from(result.buffer));
    } catch (error) {
      console.error('Track error:', error);
      res.status(500).json({ error: '이미지 처리 중 오류가 발생했습니다.' });
    }
  }
} 