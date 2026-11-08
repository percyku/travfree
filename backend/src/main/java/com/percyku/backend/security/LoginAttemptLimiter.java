package com.percyku.backend.security;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import com.percyku.backend.config.AppProperties;
import com.percyku.backend.exception.TooManyRequestsException;

/**
 * 登入失敗次數限制。同時計算「IP + 帳號」與「IP 總量」，任一種達到上限就鎖定。
 * 只看帳號的話，任何人故意輸錯就能把 admin 鎖在外面，所以一定帶上 IP。
 *
 * <p>計數存在記憶體，重啟後歸零，只適用單一實例部署。登入流量很低，直接用 synchronized。
 */
@Component
public class LoginAttemptLimiter {

	/** 計數筆數超過這個值時，下一次記錄失敗前先清掉已失效的計數，避免記憶體無限成長。 */
	private static final int CLEANUP_THRESHOLD = 10_000;

	private final AppProperties.LoginLimit limit;
	private final Clock clock;
	private final Map<String, Counter> counters = new HashMap<>();

	@Autowired
	public LoginAttemptLimiter(AppProperties properties) {
		this(properties.loginLimit(), Clock.systemUTC());
	}

	LoginAttemptLimiter(AppProperties.LoginLimit limit, Clock clock) {
		this.limit = limit;
		this.clock = clock;
	}

	/** 鎖定中就丟出 429，密碼正確也一樣，否則暴力破解仍可繼續。 */
	public synchronized void checkAllowed(String ip, String username) {
		Instant now = clock.instant();
		long retryAfter = Math.max(secondsUntilUnlock(ipKey(ip), now), secondsUntilUnlock(accountKey(ip, username), now));
		if (retryAfter > 0) {
			long minutes = (retryAfter + 59) / 60;
			throw new TooManyRequestsException("登入失敗次數過多，請 " + minutes + " 分鐘後再試", retryAfter);
		}
	}

	public synchronized void recordFailure(String ip, String username) {
		Instant now = clock.instant();
		if (counters.size() >= CLEANUP_THRESHOLD) {
			counters.values().removeIf(counter -> counter.isExpired(now));
		}
		increment(accountKey(ip, username), limit.maxFailuresPerAccount(), now);
		increment(ipKey(ip), limit.maxFailuresPerIp(), now);
	}

	/** 只清「IP + 帳號」。IP 總量不歸零，避免攻擊者穿插一次成功登入來重設計數。 */
	public synchronized void recordSuccess(String ip, String username) {
		counters.remove(accountKey(ip, username));
	}

	/** 清空所有計數，供測試使用。 */
	public synchronized void reset() {
		counters.clear();
	}

	private long secondsUntilUnlock(String key, Instant now) {
		Counter counter = counters.get(key);
		if (counter == null || !counter.isLocked(now)) {
			return 0;
		}
		long millis = Duration.between(now, counter.lockedUntil).toMillis();
		return Math.max(1, (millis + 999) / 1000);
	}

	private void increment(String key, int maxFailures, Instant now) {
		Counter counter = counters.get(key);
		if (counter != null && counter.isLocked(now)) {
			// 鎖定期間不計入，避免鎖定時間被一直延長
			return;
		}
		if (counter == null || counter.isExpired(now)) {
			counter = new Counter(now);
			counters.put(key, counter);
		}
		counter.failures++;
		if (counter.failures >= maxFailures) {
			counter.lockedUntil = now.plus(limit.lockout());
		}
	}

	private static String ipKey(String ip) {
		return "ip|" + ip;
	}

	private static String accountKey(String ip, String username) {
		String normalized = username == null ? "" : username.trim().toLowerCase(Locale.ROOT);
		return "account|" + ip + "|" + normalized;
	}

	private final class Counter {

		private final Instant windowStart;
		private int failures;
		private Instant lockedUntil;

		private Counter(Instant windowStart) {
			this.windowStart = windowStart;
		}

		private boolean isLocked(Instant now) {
			return lockedUntil != null && lockedUntil.isAfter(now);
		}

		/** 鎖定已解除，或沒有鎖定且計數視窗已過，都視為重新開始。 */
		private boolean isExpired(Instant now) {
			if (lockedUntil != null) {
				return !lockedUntil.isAfter(now);
			}
			return !windowStart.plus(limit.window()).isAfter(now);
		}
	}
}
