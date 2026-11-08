package com.percyku.backend.controller;

import java.util.Map;

import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.percyku.backend.dto.ApiResponses;
import com.percyku.backend.dto.ArticleRequest;
import com.percyku.backend.dto.DataRequest;
import com.percyku.backend.service.ArticleService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/admin")
public class AdminArticleController {

	private final ArticleService articleService;

	public AdminArticleController(ArticleService articleService) {
		this.articleService = articleService;
	}

	@GetMapping("/articles")
	public Map<String, Object> page(@RequestParam(required = false) String page) {
		return ApiResponses.pageWithMessages("articles", articleService.adminPage(page));
	}

	@GetMapping("/article/{id}")
	public Map<String, Object> get(@PathVariable String id) {
		return ApiResponses.of("article", articleService.adminGet(id));
	}

	@PostMapping("/article")
	public Map<String, Object> create(@Valid @RequestBody DataRequest<ArticleRequest> request) {
		articleService.create(request.data());
		return ApiResponses.message("已建立文章");
	}

	@PutMapping("/article/{id}")
	public Map<String, Object> update(@PathVariable String id,
			@Valid @RequestBody DataRequest<ArticleRequest> request) {
		articleService.update(id, request.data());
		return ApiResponses.message("已更新文章");
	}

	@DeleteMapping("/article/{id}")
	public Map<String, Object> delete(@PathVariable String id) {
		articleService.delete(id);
		return ApiResponses.message("已刪除文章");
	}
}
