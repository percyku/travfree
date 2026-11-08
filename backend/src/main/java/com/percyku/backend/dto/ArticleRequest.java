package com.percyku.backend.dto;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonProperty;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;

public record ArticleRequest(
		@NotBlank(message = "title 屬性不得為空") String title,
		@NotBlank(message = "description 屬性不得為空") String description,
		String image,
		@NotEmpty(message = "tag 至少選擇一個") List<String> tag,
		@JsonProperty("create_at") Long createAt,
		@NotBlank(message = "author 屬性不得為空") String author,
		@JsonProperty("isPublic") Boolean isPublic,
		@NotBlank(message = "content 屬性不得為空") String content) {
}
