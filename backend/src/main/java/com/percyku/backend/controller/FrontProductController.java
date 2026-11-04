package com.percyku.backend.controller;

import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.percyku.backend.dto.ApiResponses;
import com.percyku.backend.service.ProductService;

@RestController
@RequestMapping("/api/${app.api-path}")
public class FrontProductController {

	private final ProductService productService;

	public FrontProductController(ProductService productService) {
		this.productService = productService;
	}

	@GetMapping("/products/all")
	public Map<String, Object> all() {
		return ApiResponses.of("products", productService.frontAll());
	}

	@GetMapping("/products")
	public Map<String, Object> page(@RequestParam(required = false) String page,
			@RequestParam(required = false) String category) {
		return ApiResponses.page("products", productService.frontPage(page, category));
	}

	@GetMapping("/product/{id}")
	public Map<String, Object> get(@PathVariable String id) {
		return ApiResponses.of("product", productService.frontGet(id));
	}
}
