import { supabase } from '../config/supabase.js';

// 중복 요청 필터링 시간(초)
const DUPLICATE_FILTER_SECONDS = 3;

export class TrackService {
  static async checkDuplicateAccess(image_url, ip, userAgent, referrer) {
    const earliestValidTime = new Date();
    earliestValidTime.setSeconds(earliestValidTime.getSeconds() - DUPLICATE_FILTER_SECONDS);
    
    const { data: recentAccess, error: recentError } = await supabase
      .from('image_access_history')
      .select('id')
      .eq('image_url', image_url)
      .eq('ip_address', ip)
      .eq('user_agent', userAgent)
      .eq('referrer', referrer)
      .gte('accessed_at', earliestValidTime.toISOString())
      .order('accessed_at', { ascending: false })
      .limit(1);

    if (recentError) {
      console.error('중복 요청 확인 오류:', recentError);
      return false; // 오류 발생 시 중복이 아닌 것으로 처리
    }

    const isDuplicate = recentAccess && recentAccess.length > 0;
    if (isDuplicate) {
      console.log(`중복 요청 필터링: ${image_url} from ${ip}`);
    }

    return isDuplicate;
  }

  static async updateAccessCount(image_url, timestamp) {
    try {
      // 현재 카운트 조회
      const { data: currentData, error: fetchError } = await supabase
        .from('image_access_logs')
        .select('access_count')
        .eq('image_url', image_url)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116: 결과 없음 오류
        console.error('카운트 조회 오류:', fetchError);
        throw new Error('카운트 조회 실패');
      }

      // 기존 카운트 또는 기본값 0
      const currentCount = currentData?.access_count || 0;
      
      // 데이터베이스 업데이트 (access_count 증가)
      const { error: dbError } = await supabase
        .from('image_access_logs')
        .upsert(
          {
            image_url,
            // access_count: currentCount + 1,
            updated_at: timestamp,
          },
          { onConflict: 'image_url' }
        );

      if (dbError) {
        console.error('데이터베이스 업데이트 오류:', dbError);
        throw new Error('카운트 업데이트 실패');
      }
    } catch (error) {
      console.error('접근 카운트 업데이트 오류:', error);
      throw error;
    }
  }

  static async saveAccessHistory(image_url, ip, userAgent, referrer, timestamp) {
    try {
      const { error: historyError } = await supabase
        .from('image_access_history')
        .insert({
          image_url,
          ip_address: ip,
          user_agent: userAgent,
          referrer: referrer,
          accessed_at: timestamp
        });

      if (historyError) {
        console.error('접근 기록 저장 오류:', historyError);
        // 접근 기록 저장 실패는 무시하고 계속 진행
      }
    } catch (error) {
      console.error('접근 기록 저장 중 오류:', error);
      // 접근 기록 저장 실패는 무시하고 계속 진행
    }
  }

  static async fetchImage(image_url) {
    const imageResponse = await fetch(image_url);
    if (!imageResponse.ok) {
      throw new Error('이미지 가져오기 실패');
    }

    const imageData = await imageResponse.arrayBuffer();
    const contentType = imageResponse.headers.get('Content-Type') || 'image/jpeg';

    return { imageData, contentType };
  }
} 