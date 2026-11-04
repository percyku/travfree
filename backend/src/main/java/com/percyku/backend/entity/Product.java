package com.percyku.backend.entity;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import com.percyku.backend.dto.ProductRequest;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "products")
public class Product extends BaseEntity {

	@Column(nullable = false)
	private String title;

	@Column(nullable = false)
	private String category;

	@Column(nullable = false)
	private String unit;

	@Column(name = "origin_price", nullable = false)
	private int originPrice;

	@Column(nullable = false)
	private int price;

	@Column(columnDefinition = "text")
	private String description;

	@Column(columnDefinition = "text")
	private String content;

	@Column(name = "is_enabled", nullable = false)
	private boolean enabled;

	@Column(name = "image_url", columnDefinition = "text")
	private String imageUrl;

	@JdbcTypeCode(SqlTypes.JSON)
	@Column(name = "images_url")
	private List<String> imagesUrl = new ArrayList<>();

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt = Instant.now();

	public void apply(ProductRequest request) {
		title = request.title();
		category = request.category();
		unit = request.unit();
		originPrice = request.originPrice();
		price = request.price();
		description = request.description();
		content = request.content();
		enabled = request.isEnabled() != null && request.isEnabled() == 1;
		imageUrl = request.imageUrl();
		imagesUrl = request.imagesUrl() == null ? new ArrayList<>() : new ArrayList<>(request.imagesUrl());
	}

	public String getTitle() {
		return title;
	}

	public String getCategory() {
		return category;
	}

	public String getUnit() {
		return unit;
	}

	public int getOriginPrice() {
		return originPrice;
	}

	public int getPrice() {
		return price;
	}

	public String getDescription() {
		return description;
	}

	public String getContent() {
		return content;
	}

	public boolean isEnabled() {
		return enabled;
	}

	public String getImageUrl() {
		return imageUrl;
	}

	public List<String> getImagesUrl() {
		return imagesUrl;
	}
}
