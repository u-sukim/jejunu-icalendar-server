import type { Lecture } from './response';

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
  const dateString = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${date.slice(9, 11)}:${date.slice(11, 13)}:${date.slice(13, 15)}`;
  return new Date(dateString);
}

/**
 * 미래 강의(아직 진행되지 않은 강의)의 경우 '휴강'이라 하더라도 포함시키도록 합니다.
 */
export function reconstructedLecture(
  lecture: Lecture,
  status: LectureStatus
): ReconstructedLecture | null {
  const year = lecture.lsnYmd.slice(0, 4);
  const month = lecture.lsnYmd.slice(4, 6);
  const day = lecture.lsnYmd.slice(6, 8);
  const eventDate = new Date(`${year}-${month}-${day}`);

  const today = new Date();
  // 과거 날짜에 대해서만 '휴강' 강의는 제거
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

/**
 * 동일한 강의명과 날짜를 가진 이벤트를 병합합니다.
 * 만약 두 이벤트 중 하나라도 '일반'이 아닌 상태라면 그 상태를 사용합니다.
 */
export function mergeLectures(lectures: ReconstructedLecture[]) {
  return lectures
    .filter((lecture) => lecture !== null)
    .reduce((merged, lecture) => {
      if (merged.length === 0) return [lecture];
      const last = merged.at(-1)!;
      if (last.name === lecture.name && last.date === lecture.date) {
        // 병합: 상태가 '일반'이 아니면 그 값을 사용
        last.status = last.status !== '일반' ? last.status : (lecture.status !== '일반' ? lecture.status : '일반');
        // 종료 시간은 마지막 이벤트의 시간을 적용
        last.endTime = lecture.endTime;
      } else {
        merged.push(lecture);
      }
      return merged;
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

  const mergedLectures = mergeLectures(reconstructedLectures);
  const events = mergedLectures
    .map(lectureToICalEvent)
    .join('\n\n');
  return `BEGIN:VCALENDAR
VERSION:2.0

${events}

END:VCALENDAR
`;
}
