import type { Lecture } from './response';

// 타입 정의 (필요에 따라 수정)
export type LectureStatus = '온라인(녹화)' | '온라인(실시간)' | '보강' | '휴강' | '일반';
export type ReconstructedLecture = {
  startTime: string;
  endTime: string;
  date: string;
  name: string;
  lecturer: string;
  status: LectureStatus;
  location: string | null;
};

export function parseLectureStatus(lecture: Lecture): LectureStatus {
  const hasLeadingNine = (str: string | null) => str?.[0] === '9';
  const isRecordedLecture = hasLeadingNine(lecture.aftrSplctLttmSe);

  if (lecture.cclctYn === 'Y')
    return isRecordedLecture ? '온라인(녹화)' : '휴강';

  if (lecture.splctYn === 'Y') {
    const isLiveStreamLecture = hasLeadingNine(lecture.untactLsnMthdSe);
    if (isRecordedLecture) return '온라인(녹화)';
    if (isLiveStreamLecture) return '온라인(실시간)';
    return '보강';
  }
  return '일반';
}

/**
 * @param date string @example '20240909'
 * @param time string @example '09:00'
 * @returns string @example '20240909T090000'
 */
export function formatToICalDate(date: string, time: string) {
  return `${date}T${time.replace(':', '')}00`;
}

function iCalDateStringToDateObject(date: string) {
  // 입력 예: '20240909T090000'
  const formatted = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${date.slice(9, 11)}:${date.slice(11, 13)}:${date.slice(13, 15)}`;
  return new Date(formatted);
}

/**
 * 변환 로직에서 기존에는 '휴강' 상태인 강의를 무조건 제거하고 있었음.
 * 하지만 미래 강의(예: 2학년 1학기)는 아직 진행되지 않았으므로, '휴강'으로 표시되더라도 포함시키도록 수정합니다.
 */
export function reconstructedLecture(
  lecture: Lecture,
  status: LectureStatus
): ReconstructedLecture | null {
  // lecture.lsnYmd는 'YYYYMMDD' 형식임. 이를 Date 객체로 변환.
  const year = lecture.lsnYmd.slice(0, 4);
  const month = lecture.lsnYmd.slice(4, 6);
  const day = lecture.lsnYmd.slice(6, 8);
  const eventDate = new Date(`${year}-${month}-${day}`);

  const today = new Date();

  // 만약 강의 상태가 '휴강'이고, 이벤트 날짜가 과거라면 필터링(제거)
  // 미래 강의라면 '휴강'이어도 포함시킵니다.
  if (status === '휴강' && eventDate < today) return null;

  const startTime = formatToICalDate(lecture.lsnYmd, lecture.bgngHr);
  const endTime = formatToICalDate(lecture.lsnYmd, lecture.endHr);

  return {
    startTime,
    endTime,
    date: lecture.lsnYmd,
    name: lecture.sbjctNm,
    lecturer: lecture.empnm,
    ...(status === '온라인(실시간)' || status === '온라인(녹화)'
      ? { status, location: null }
      : { status, location: lecture.lctrmNm }),
  };
}

export function mergeLectures(lectures: ReconstructedLecture[]) {
  return lectures
    .filter((lecture) => lecture !== null)
    .reduce((reducing, lecture) => {
      if (reducing.length === 0) return [lecture];
      const previousLecture = reducing.at(-1)!;

      if (
        previousLecture.name === lecture.name &&
        previousLecture.date === lecture.date
      ) {
        const status = (() => {
          if (previousLecture.status !== '일반') return previousLecture.status;
          if (lecture.status !== '일반') return lecture.status;
          return '일반';
        })();
        previousLecture.endTime = lecture.endTime;
      } else {
        reducing.push(lecture);
      }

      return reducing;
    }, [] as Exclude<ReconstructedLecture, null>[]);
}

export function lectureToICalEvent(
  lecture: Exclude<ReconstructedLecture, null>
): string {
  return `BEGIN:VEVENT
DTSTART;TZID=Asia/Seoul:${lecture.startTime}
DTEND;TZID=Asia/Seoul:${lecture.endTime}
SUMMARY:${lecture.name}${lecture.status !== '일반' ? ` - ${lecture.status}` : ''}
${lecture.location ? `LOCATION:${lecture.location}` : ''}
DESCRIPTION:${lecture.lecturer}
END:VEVENT`.trim();
}

export function iCalConverter(lectures: Lecture[]) {
  const reconstructedLectures = lectures
    .filter(
      (lecture): lecture is Exclude<Lecture, null> =>
        lecture !== null && lecture.bgngHr !== null && lecture.endHr !== null
    )
    .map((lecture) => {
      const status = parseLectureStatus(lecture);
      // 디버깅 로그 추가: 강의명, 날짜, 상태 출력
      console.log(`변환 중: ${lecture.sbjctNm}, 날짜: ${lecture.lsnYmd}, 상태: ${status}`);
      return reconstructedLecture(lecture, status);
    })
    .filter(
      (lecture): lecture is Exclude<ReconstructedLecture, null> =>
        lecture !== null
    )
    .sort(
      (a, b) =>
        iCalDateStringToDateObject(a.startTime).getTime() -
        iCalDateStringToDateObject(b.startTime).getTime()
    );

  const events = mergeLectures(reconstructedLectures)
    .map(lectureToICalEvent)
    .join('\n\n');
  return `BEGIN:VCALENDAR
VERSION:2.0

${events}

END:VCALENDAR
`;
}
