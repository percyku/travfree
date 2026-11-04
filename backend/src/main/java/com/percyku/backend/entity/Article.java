package com.percyku.backend.entity;

import java.util.ArrayList;
import java.util.List;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import com.percyku.backend.dto.ArticleRequest;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "articles")
public class Article extends BaseEntity {

	@Column(nullable = false)
	private String title;

	@Column(columnDefinition = "text", nullable = false)
	private String description;

	@Column(columnDefinition = "text")
	private String image;

	@JdbcTypeCode(SqlTypes.JSON)
	@Column(name = "tag")
	private List<String> tag = new ArrayList<>();

	/** 由前端傳入，原值保存不換算：現有前端傳毫秒，並以 new Date(create_at) 顯示。 */
	@Column(name = "create_at", nullable = false)
	private long createAt;

	@Column(nullable = false)
	private String author;

	@Column(name = "is_public", nullable = false)
	private boolean publicArticle;

	@Column(columnDefinition = "text", nullable = false)
	private String content;

	public void apply(ArticleRequest request, long defaultCreateAt) {
		title = request.title();
		description = request.description();
		image = request.image();
		tag = request.tag() == null ? new ArrayList<>() : new ArrayList<>(request.tag());
		createAt = request.createAt() == null ? defaultCreateAt : request.createAt();
		author = request.author();
		publicArticle = Boolean.TRUE.equals(request.isPublic());
		content = request.content();
	}

	public String getTitle() {
		return title;
	}

	public String getDescription() {
		return description;
	}

	public String getImage() {
		return image;
	}

	public List<String> getTag() {
		return tag;
	}

	public long getCreateAt() {
		return createAt;
	}

	public String getAuthor() {
		return author;
	}

	public boolean isPublicArticle() {
		return publicArticle;
	}

	public String getContent() {
		return content;
	}
}
