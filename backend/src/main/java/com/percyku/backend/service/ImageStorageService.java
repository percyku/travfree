package com.percyku.backend.service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import com.percyku.backend.config.AppProperties;
import com.percyku.backend.exception.ApiException;

@Service
public class ImageStorageService {

	private static final long MAX_SIZE = 3 * 1024 * 1024;
	private static final byte[] JPEG_MAGIC = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF};
	private static final byte[] PNG_MAGIC = {(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n'};
	private static final Set<String> JPEG_EXTENSIONS = Set.of("jpg", "jpeg");

	private final Path uploadDir;
	private final String publicBaseUrl;

	public ImageStorageService(AppProperties properties) throws IOException {
		this.uploadDir = Path.of(properties.uploadDir()).toAbsolutePath().normalize();
		this.publicBaseUrl = StringUtils.trimTrailingCharacter(properties.publicBaseUrl(), '/');
		Files.createDirectories(uploadDir);
	}

	/** 副檔名與檔案內容都要是 jpg/png，存檔時用 UUID 重新命名，不採用使用者的檔名。 */
	public String store(MultipartFile file) {
		if (file.isEmpty()) {
			throw ApiException.badRequest("檔案格式錯誤");
		}
		if (file.getSize() > MAX_SIZE) {
			throw ApiException.badRequest("檔案大小不得超過 3MB");
		}
		String filename = UUID.randomUUID() + "." + detectExtension(file);
		try (InputStream content = file.getInputStream()) {
			Files.copy(content, uploadDir.resolve(filename));
		} catch (IOException e) {
			throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "檔案儲存失敗");
		}
		return publicBaseUrl + "/uploads/" + filename;
	}

	private static String detectExtension(MultipartFile file) {
		String extension = StringUtils.getFilenameExtension(file.getOriginalFilename());
		extension = extension == null ? "" : extension.toLowerCase(Locale.ROOT);
		byte[] header = readHeader(file);
		if (JPEG_EXTENSIONS.contains(extension) && startsWith(header, JPEG_MAGIC)) {
			return "jpg";
		}
		if ("png".equals(extension) && startsWith(header, PNG_MAGIC)) {
			return "png";
		}
		throw ApiException.badRequest("檔案格式錯誤");
	}

	private static byte[] readHeader(MultipartFile file) {
		try (InputStream content = file.getInputStream()) {
			return content.readNBytes(PNG_MAGIC.length);
		} catch (IOException e) {
			throw ApiException.badRequest("檔案格式錯誤");
		}
	}

	private static boolean startsWith(byte[] header, byte[] magic) {
		return header.length >= magic.length
				&& Arrays.equals(header, 0, magic.length, magic, 0, magic.length);
	}
}
