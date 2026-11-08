package com.percyku.backend.controller;

import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.percyku.backend.dto.ApiResponses;
import com.percyku.backend.service.ArticleService;

@RestController
@RequestMapping("/api")
public class FrontArticleController {

	private final ArticleService articleService;

	public FrontArticleController(ArticleService articleService) {
		this.articleService = articleService;
	}

	@GetMapping("/articles")
	public Map<String, Object> page(@RequestParam(required = false) String page) {
		return ApiResponses.pageWithMessages("articles", articleService.frontPage(page));
	}

	@GetMapping("/article/{id}")
	public Map<String, Object> get(@PathVariable String id) {
		return ApiResponses.of("article", articleService.frontGet(id));
	}
}
