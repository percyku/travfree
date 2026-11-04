package com.percyku.backend.dto;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.percyku.backend.entity.Article;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ArticleResponse(
		String id,
		String title,
		String description,
		String image,
		List<String> tag,
		@JsonProperty("create_at") long createAt,
		String author,
		@JsonProperty("isPublic") boolean isPublic,
		String content,
		Integer num) {

	/** 含內文：單篇查詢與 Admin 清單（Admin 編輯時直接用清單資料帶入 content）。 */
	public static ArticleResponse full(Article article, Integer num) {
		return build(article, article.getContent(), num);
	}

	/** 不含內文：Front 清單，與 Hexschool 相同。 */
	public static ArticleResponse summary(Article article, Integer num) {
		return build(article, null, num);
	}

	private static ArticleResponse build(Article article, String content, Integer num) {
		return new ArticleResponse(
				article.getId(),
				article.getTitle(),
				article.getDescription(),
				article.getImage(),
				article.getTag(),
				article.getCreateAt(),
				article.getAuthor(),
				article.isPublicArticle(),
				content,
				num);
	}
}
