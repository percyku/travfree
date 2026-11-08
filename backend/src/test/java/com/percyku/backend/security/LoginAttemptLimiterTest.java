package com.percyku.backend.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.catchThrowableOfType;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.percyku.backend.config.AppProperties;
import com.percyku.backend.exception.TooManyRequestsException;

/** 時間相關的行為，整合測試無法快轉時鐘，所以在這裡測。 */
class LoginAttemptLimiterTest {

	private static final String IP = "10.0.0.1";
	private static final String USER = "admin@gmail.com";

	private MutableClock clock;
	private LoginAttemptLimiter limiter;

	@BeforeEach
	void setUp() {
		clock = new MutableClock(Instant.parse("2026-11-08T00:00:00Z"));
		AppProperties.LoginLimit limit = new AppProperties.LoginLimit(5, 20, Duration.ofMinutes(15),
				Duration.ofMinutes(15));
		limiter = new LoginAttemptLimiter(limit, clock);
	}

	@Test
	void lockExpiresAfterLockoutAndCountingStartsOver() {
		fail(5);
		assertThat(retryAfter()).isEqualTo(900);

		clock.advance(Duration.ofMinutes(15));
		assertThatCode(this::check).doesNotThrowAnyException();

		fail(1);
		assertThatCode(this::check).doesNotThrowAnyException();
	}

	@Test
	void failuresOutsideTheWindowAreNotCounted() {
		fail(4);
		clock.advance(Duration.ofMinutes(15));
		fail(1);

		assertThatCode(this::check).doesNotThrowAnyException();
	}

	@Test
	void failuresDuringLockDoNotExtendIt() {
		fail(5);
		clock.advance(Duration.ofMinutes(10));
		fail(3);

		assertThat(retryAfter()).isEqualTo(300);
	}

	@Test
	void retryAfterIsRoundedUpToWholeSecondsAndMinutes() {
		fail(5);
		clock.advance(Duration.ofMillis(899_500));

		TooManyRequestsException e = catchThrowableOfType(TooManyRequestsException.class, this::check);
		assertThat(e.getRetryAfterSeconds()).isEqualTo(1);
		assertThat(e.getMessage()).isEqualTo("登入失敗次數過多，請 1 分鐘後再試");
	}

	private void fail(int times) {
		for (int i = 0; i < times; i++) {
			limiter.recordFailure(IP, USER);
		}
	}

	private void check() {
		limiter.checkAllowed(IP, USER);
	}

	private long retryAfter() {
		return catchThrowableOfType(TooManyRequestsException.class, this::check).getRetryAfterSeconds();
	}

	private static final class MutableClock extends Clock {

		private Instant now;

		private MutableClock(Instant now) {
			this.now = now;
		}

		void advance(Duration duration) {
			now = now.plus(duration);
		}

		@Override
		public Instant instant() {
			return now;
		}

		@Override
		public ZoneId getZone() {
			return ZoneOffset.UTC;
		}

		@Override
		public Clock withZone(ZoneId zone) {
			return this;
		}
	}
}
