package com.percyku.backend.exception;

import org.springframework.http.HttpStatus;

/** 業務錯誤，由 GlobalExceptionHandler 轉成 {success:false, message}。 */
public class ApiException extends RuntimeException {

	private final HttpStatus status;

	public ApiException(HttpStatus status, String message) {
		super(message);
		this.status = status;
	}

	public static ApiException badRequest(String message) {
		return new ApiException(HttpStatus.BAD_REQUEST, message);
	}

	public static ApiException forbidden(String message) {
		return new ApiException(HttpStatus.FORBIDDEN, message);
	}

	public static ApiException notFound(String message) {
		return new ApiException(HttpStatus.NOT_FOUND, message);
	}

	public HttpStatus getStatus() {
		return status;
	}
}
