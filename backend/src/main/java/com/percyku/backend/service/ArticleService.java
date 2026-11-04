package com.percyku.backend.service;

import java.time.Instant;

import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.percyku.backend.dto.ArticleRequest;
import com.percyku.backend.dto.ArticleResponse;
import com.percyku.backend.dto.PagedResult;
import com.percyku.backend.entity.Article;
import com.percyku.backend.exception.ApiException;
import com.percyku.backend.repository.ArticleRepository;

@Service
@Transactional(readOnly = true)
public class ArticleService {

	private static final Sort NEWEST_FIRST = Sort.by(Sort.Order.desc("createAt"), Sort.Order.desc("id"));

	private final ArticleRepository articleRepository;

	public ArticleService(ArticleRepository articleRepository) {
		this.articleRepository = articleRepository;
	}

	public PagedResult<ArticleResponse> adminPage(String page) {
		return PagedResult.fetch(page, null, NEWEST_FIRST, articleRepository::findAll, ArticleResponse::full);
	}

	public ArticleResponse adminGet(String id) {
		return articleRepository.findById(id)
				.map(article -> ArticleResponse.full(article, null))
				.orElseThrow(() -> ApiException.notFound("找不到文章"));
	}

	public PagedResult<ArticleResponse> frontPage(String page) {
		return PagedResult.fetch(page, null, NEWEST_FIRST,
				articleRepository::findByPublicArticleTrue, ArticleResponse::summary);
	}

	public ArticleResponse frontGet(String id) {
		return articleRepository.findByIdAndPublicArticleTrue(id)
				.map(article -> ArticleResponse.full(article, null))
				.orElseThrow(() -> ApiException.notFound("找不到文章"));
	}

	@Transactional
	public void create(ArticleRequest request) {
		Article article = new Article();
		article.apply(request, Instant.now().toEpochMilli());
		articleRepository.save(article);
	}

	@Transactional
	public void update(String id, ArticleRequest request) {
		Article article = articleRepository.findById(id)
				.orElseThrow(() -> ApiException.notFound("找不到文章"));
		article.apply(request, article.getCreateAt());
	}

	@Transactional
	public void delete(String id) {
		if (!articleRepository.existsById(id)) {
			throw ApiException.notFound("找不到文章");
		}
		articleRepository.deleteById(id);
	}
}
