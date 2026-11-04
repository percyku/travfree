package com.percyku.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Arrays;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.ResultActions;

class UploadApiTest extends ApiTestSupport {

	private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n', 1, 2, 3};
	private static final byte[] JPEG = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 1, 2, 3};
	private static final String UPLOAD = API + "/admin/upload";

	private ResultActions upload(String filename, byte[] bytes) throws Exception {
		return mockMvc.perform(auth(multipart(UPLOAD)
				.file(new MockMultipartFile("file-to-upload", filename, "image/png", bytes))));
	}

	@Test
	void uploadedImageIsPubliclyServed() throws Exception {
		String imageUrl = read(upload("photo.png", PNG)
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.success").value(true)))
				.get("imageUrl").asText();

		assertThat(imageUrl).startsWith("http://localhost:8080/v2/uploads/").endsWith(".png");
		String path = imageUrl.substring("http://localhost:8080/v2".length());
		mockMvc.perform(get(path))
				.andExpect(status().isOk())
				.andExpect(content().bytes(PNG));
	}

	@Test
	void jpegExtensionsAreAccepted() throws Exception {
		upload("photo.jpg", JPEG).andExpect(status().isOk());
		upload("PHOTO.JPEG", JPEG).andExpect(status().isOk());
	}

	@Test
	void fileContentMustMatchAllowedImageType() throws Exception {
		upload("fake.png", "<script>alert(1)</script>".getBytes())
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.success").value(false))
				.andExpect(jsonPath("$.message").value("檔案格式錯誤"));
		upload("photo.gif", PNG).andExpect(status().isBadRequest());
		upload("noextension", PNG).andExpect(status().isBadRequest());
		upload("mismatch.jpg", PNG).andExpect(status().isBadRequest());
		upload("empty.png", new byte[0]).andExpect(status().isBadRequest());
	}

	@Test
	void oversizedFileIsRejected() throws Exception {
		byte[] large = Arrays.copyOf(PNG, 3 * 1024 * 1024 + 1);

		upload("large.png", large)
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("檔案大小不得超過 3MB"));
	}

	@Test
	void wrongFieldNameIsRejected() throws Exception {
		mockMvc.perform(auth(multipart(UPLOAD)
				.file(new MockMultipartFile("file", "photo.png", "image/png", PNG))))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.success").value(false));
	}
}
