package com.percyku.backend.dto;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.percyku.backend.entity.Product;

/** 也作為訂單快照存進 order_items.product_snapshot。 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ProductResponse(
		String id,
		String title,
		String category,
		String unit,
		@JsonProperty("origin_price") int originPrice,
		int price,
		String description,
		String content,
		@JsonProperty("is_enabled") int isEnabled,
		String imageUrl,
		List<String> imagesUrl,
		Integer num) {

	public static ProductResponse from(Product product) {
		return from(product, null);
	}

	public static ProductResponse from(Product product, Integer num) {
		return new ProductResponse(
				product.getId(),
				product.getTitle(),
				product.getCategory(),
				product.getUnit(),
				product.getOriginPrice(),
				product.getPrice(),
				product.getDescription(),
				product.getContent(),
				product.isEnabled() ? 1 : 0,
				product.getImageUrl(),
				product.getImagesUrl(),
				num);
	}
}
