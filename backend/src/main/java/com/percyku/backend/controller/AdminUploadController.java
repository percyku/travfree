package com.percyku.backend.controller;

import java.util.Map;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.percyku.backend.dto.ApiResponses;
import com.percyku.backend.service.ImageStorageService;

@RestController
@RequestMapping("/api/admin")
public class AdminUploadController {

	private final ImageStorageService imageStorageService;

	public AdminUploadController(ImageStorageService imageStorageService) {
		this.imageStorageService = imageStorageService;
	}

	@PostMapping("/upload")
	public Map<String, Object> upload(@RequestParam("file-to-upload") MultipartFile file) {
		return ApiResponses.of("imageUrl", imageStorageService.store(file));
	}
}
