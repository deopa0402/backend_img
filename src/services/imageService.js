import { supabase, serviceSupabase } from '../config/supabase.js';
import { nanoid } from 'nanoid';

// 중복 요청 필터링 시간(초)
const DUPLICATE_FILTER_SECONDS = 3;

// 파일명에서 확장자 추출
function getFileExtension(filename) {
  return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2);
}

// 안전한 파일명 생성
function createSafeFileName(originalName) {
  // 확장자 추출
  const ext = getFileExtension(originalName);
  // 파일명에서 확장자 제거
  const nameWithoutExt = originalName.slice(0, originalName.lastIndexOf('.'));
  // 한글 파일명을 영문으로 변환 (예: '이미지' -> 'image')
  const safeName = nameWithoutExt
    .replace(/[가-힣]/g, '') // 한글 제거
    .replace(/[^a-zA-Z0-9]/g, '_') // 특수문자를 언더스코어로 변환
    .toLowerCase(); // 소문자로 변환

  // 파일명이 비어있으면 'image' 사용
  const finalName = safeName || 'image';
  return `${nanoid()}-${finalName}.${ext}`;
}

export class ImageService {
  static async uploadImage(fileBuffer, originalName, mimeType) {
    const fileName = createSafeFileName(originalName);

    // 서비스 롤을 사용하여 스토리지에 업로드
    const { data, error } = await serviceSupabase.storage
      .from('images')
      .upload(fileName, fileBuffer, {
        contentType: mimeType,
        cacheControl: '3600'
      });

    if (error) throw error;

    const { data: { publicUrl } } = serviceSupabase.storage
      .from('images')
      .getPublicUrl(fileName);

    return publicUrl;
  }

  static async createShortUrl(imageUrl) {
    if (!imageUrl || !imageUrl.startsWith('https://')) {
      throw new Error('유효한 image_url이 필요합니다');
    }

    const shortId = nanoid(7);
    // 서비스 롤을 사용하여 데이터베이스에 저장
    const { error } = await serviceSupabase
      .from('shortened_urls')
      .insert({
        short_id: shortId,
        original_url: imageUrl,
        created_at: new Date().toISOString()
      });

    if (error) throw error;

    return shortId;
  }

  static async trackImageView(imageUrl, ip, userAgent, referrer) {
    if (!imageUrl || !imageUrl.startsWith('https://')) {
      throw new Error('유효한 image_url이 필요합니다');
    }

    const timestamp = new Date().toISOString();

    // 우리 페이지에서의 접근인지 확인
    const isInternalAccess = referrer?.includes('img-rust-eight.vercel.app');
    if (isInternalAccess) {
      // 내부 접근은 이미지만 반환
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        throw new Error('이미지를 가져오는데 실패했습니다');
      }
      return {
        buffer: await imageResponse.arrayBuffer(),
        contentType: imageResponse.headers.get('Content-Type') || 'image/jpeg'
      };
    }

    // 최근 DUPLICATE_FILTER_SECONDS초 이내의 동일 요청자 확인
    const earliestValidTime = new Date();
    earliestValidTime.setSeconds(earliestValidTime.getSeconds() - DUPLICATE_FILTER_SECONDS);
    
    // 서비스 롤을 사용하여 데이터베이스 조회
    const { data: recentAccess } = await serviceSupabase
      .from('image_access_history')
      .select('id')
      .eq('image_url', imageUrl)
      .eq('ip_address', ip)
      .eq('user_agent', userAgent)
      .eq('referrer', referrer)
      .gte('accessed_at', earliestValidTime.toISOString())
      .order('accessed_at', { ascending: false })
      .limit(1);

    // 중복 요청이 아닌 경우에만 처리
    if (!recentAccess || recentAccess.length === 0) {
      // 상세 접근 기록 저장
      await serviceSupabase
        .from('image_access_history')
        .insert({
          image_url: imageUrl,
          ip_address: ip,
          user_agent: userAgent,
          referrer: referrer,
          accessed_at: timestamp
        });
    }

    // 이미지 데이터 가져오기
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error('이미지를 가져오는데 실패했습니다');
    }

    return {
      buffer: await imageResponse.arrayBuffer(),
      contentType: imageResponse.headers.get('Content-Type') || 'image/jpeg'
    };
  }

  static async getOriginalUrl(shortId) {
    const { data, error } = await serviceSupabase
      .from('shortened_urls')
      .select('original_url')
      .eq('short_id', shortId)
      .single();

    if (error) throw error;
    if (!data) throw new Error('단축 URL을 찾을 수 없습니다.');

    return data.original_url;
  }
} 