import puppeteer from 'puppeteer';
import { Value } from '@sinclair/typebox/value';
import { upload } from './aws';
import { username, password } from './env';
import { iCalConverter } from './iCalConverter';
import { ResponseTObject } from './response';

(async () => {
  // Puppeteer 설정 수정
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--single-process'
    ],
    executablePath: process.env.CHROME_BIN || undefined
  });
  
  const page = await browser.newPage();

  console.log('포털 페이지로 이동 중...');
  await page.goto('https://portal.jejunu.ac.kr/login.htm', {
    waitUntil: 'networkidle0',
    timeout: 60000
  });

  console.log('로그인 정보 입력 중...');
  await page.type('#userId', username);
  await page.type('#userPswd', password);

  console.log('로그인 시도 중...');
  await page.click('[type="submit"]');

  console.log('로그인 후 페이지 로드 대기 중...');
  await page.waitForNavigation({
    waitUntil: 'networkidle0',
    timeout: 60000
  });

  console.log('시간표 데이터 요청 중...');
  const response = await page.goto(
    'https://portal.jejunu.ac.kr/api/patis/timeTable.jsp?sttLsnYmd=20240902&endLsnYmd=20241221',
    {
      waitUntil: 'networkidle0',
      timeout: 60000
    }
  );

  if (response?.ok()) {
    console.log('데이터 변환 중...');
    const { classTables } = Value.Parse(ResponseTObject, await response.json());
    console.log('AWS S3에 업로드 중...');
    await upload(iCalConverter(classTables));
    console.log('작업 완료!');
  } else {
    console.error('데이터 가져오기 실패');
  }

  await browser.close();
})().catch(error => {
  console.error('오류 발생:', error);
  process.exit(1);
});
