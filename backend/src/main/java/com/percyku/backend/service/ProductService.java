package com.percyku.backend.service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import com.percyku.backend.dto.PagedResult;
import com.percyku.backend.dto.ProductRequest;
import com.percyku.backend.dto.ProductResponse;
import com.percyku.backend.entity.Product;
import com.percyku.backend.exception.ApiException;
import com.percyku.backend.repository.CartItemRepository;
import com.percyku.backend.repository.ProductRepository;

@Service
@Transactional(readOnly = true)
public class ProductService {

	private static final Sort NEWEST_FIRST = Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"));
	private static final Sort OLDEST_FIRST = Sort.by(Sort.Order.asc("createdAt"), Sort.Order.asc("id"));

	private final ProductRepository productRepository;
	private final CartItemRepository cartItemRepository;

	public ProductService(ProductRepository productRepository, CartItemRepository cartItemRepository) {
		this.productRepository = productRepository;
		this.cartItemRepository = cartItemRepository;
	}

	public PagedResult<ProductResponse> adminPage(String page, String category) {
		String filter = blankToNull(category);
		return PagedResult.fetch(page, filter, NEWEST_FIRST,
				pageable -> filter == null
						? productRepository.findAll(pageable)
						: productRepository.findByCategory(filter, pageable),
				ProductResponse::from);
	}

	public Map<String, ProductResponse> adminAll() {
		Map<String, ProductResponse> products = new LinkedHashMap<>();
		for (Product product : productRepository.findAll(OLDEST_FIRST)) {
			products.put(product.getId(), ProductResponse.from(product));
		}
		return products;
	}

	public PagedResult<ProductResponse> frontPage(String page, String category) {
		String filter = blankToNull(category);
		return PagedResult.fetch(page, filter, NEWEST_FIRST,
				pageable -> filter == null
						? productRepository.findByEnabledTrue(pageable)
						: productRepository.findByEnabledTrueAndCategory(filter, pageable),
				ProductResponse::from);
	}

	public List<ProductResponse> frontAll() {
		return productRepository.findByEnabledTrue(OLDEST_FIRST).stream().map(ProductResponse::from).toList();
	}

	public ProductResponse frontGet(String id) {
		return productRepository.findByIdAndEnabledTrue(id)
				.map(ProductResponse::from)
				.orElseThrow(() -> ApiException.notFound("找不到產品"));
	}

	@Transactional
	public void create(ProductRequest request) {
		Product product = new Product();
		product.apply(request);
		productRepository.save(product);
	}

	@Transactional
	public void update(String id, ProductRequest request) {
		productRepository.findById(id)
				.orElseThrow(() -> ApiException.notFound("id 不存在"))
				.apply(request);
	}

	@Transactional
	public void delete(String id) {
		if (!productRepository.existsById(id)) {
			throw ApiException.notFound("找不到產品");
		}
		cartItemRepository.deleteByProductId(id);
		productRepository.deleteById(id);
	}

	private static String blankToNull(String value) {
		return StringUtils.hasText(value) ? value : null;
	}
}
