package com.percyku.backend.exception;

import java.util.Map;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.ObjectError;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import com.percyku.backend.dto.ApiResponses;

@RestControllerAdvice
public class GlobalExceptionHandler {

	private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

	@ExceptionHandler(ApiException.class)
	public ResponseEntity<Map<String, Object>> handleApi(ApiException e) {
		return failure(e.getStatus(), e.getMessage());
	}

	@ExceptionHandler(MethodArgumentNotValidException.class)
	public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException e) {
		String message = e.getBindingResult().getAllErrors().stream()
				.map(ObjectError::getDefaultMessage)
				.sorted()
				.distinct()
				.collect(Collectors.joining("、"));
		return failure(HttpStatus.BAD_REQUEST, message);
	}

	@ExceptionHandler(HttpMessageNotReadableException.class)
	public ResponseEntity<Map<String, Object>> handleUnreadable(HttpMessageNotReadableException e) {
		return failure(HttpStatus.BAD_REQUEST, "資料格式不正確");
	}

	@ExceptionHandler(MaxUploadSizeExceededException.class)
	public ResponseEntity<Map<String, Object>> handleTooLarge(MaxUploadSizeExceededException e) {
		return failure(HttpStatus.BAD_REQUEST, "檔案大小不得超過 3MB");
	}

	@ExceptionHandler({MultipartException.class, MissingServletRequestPartException.class})
	public ResponseEntity<Map<String, Object>> handleMultipart(Exception e) {
		return failure(HttpStatus.BAD_REQUEST, "檔案格式錯誤");
	}

	@ExceptionHandler(NoResourceFoundException.class)
	public ResponseEntity<Map<String, Object>> handleNotFound(NoResourceFoundException e) {
		return failure(HttpStatus.NOT_FOUND, "找不到資源");
	}

	@ExceptionHandler(HttpRequestMethodNotSupportedException.class)
	public ResponseEntity<Map<String, Object>> handleMethod(HttpRequestMethodNotSupportedException e) {
		return failure(HttpStatus.METHOD_NOT_ALLOWED, "不支援的請求方法");
	}

	@ExceptionHandler(HttpMediaTypeNotSupportedException.class)
	public ResponseEntity<Map<String, Object>> handleMediaType(HttpMediaTypeNotSupportedException e) {
		return failure(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "不支援的內容格式");
	}

	@ExceptionHandler(DataIntegrityViolationException.class)
	public ResponseEntity<Map<String, Object>> handleIntegrity(DataIntegrityViolationException e) {
		log.warn("資料完整性錯誤: {}", e.getMostSpecificCause().getMessage());
		return failure(HttpStatus.BAD_REQUEST, "資料不符合限制，請確認後重試");
	}

	@ExceptionHandler(Exception.class)
	public ResponseEntity<Map<String, Object>> handleUnexpected(Exception e) {
		log.error("未預期的錯誤", e);
		return failure(HttpStatus.INTERNAL_SERVER_ERROR, "伺服器錯誤");
	}

	private ResponseEntity<Map<String, Object>> failure(HttpStatus status, String message) {
		return ResponseEntity.status(status).body(ApiResponses.failure(message));
	}
}
