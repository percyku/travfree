package com.percyku.backend.exception;

import org.springframework.http.HttpStatus;

/** 429，GlobalExceptionHandler 會另外加上 Retry-After header。 */
public class TooManyRequestsException extends ApiException {

	private final long retryAfterSeconds;

	public TooManyRequestsException(String message, long retryAfterSeconds) {
		super(HttpStatus.TOO_MANY_REQUESTS, message);
		this.retryAfterSeconds = retryAfterSeconds;
	}

	public long getRetryAfterSeconds() {
		return retryAfterSeconds;
	}
}
