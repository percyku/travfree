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
import com.percyku.backend.dto.DataRequest;
import com.percyku.backend.dto.ProductRequest;
import com.percyku.backend.service.ProductService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/admin")
public class AdminProductController {

	private final ProductService productService;

	public AdminProductController(ProductService productService) {
		this.productService = productService;
	}

	@GetMapping("/products/all")
	public Map<String, Object> all() {
		return ApiResponses.of("products", productService.adminAll());
	}

	@GetMapping("/products")
	public Map<String, Object> page(@RequestParam(required = false) String page,
			@RequestParam(required = false) String category) {
		return ApiResponses.pageWithMessages("products", productService.adminPage(page, category));
	}

	@PostMapping("/product")
	public Map<String, Object> create(@Valid @RequestBody DataRequest<ProductRequest> request) {
		productService.create(request.data());
		return ApiResponses.message("已建立產品");
	}

	@PutMapping("/product/{id}")
	public Map<String, Object> update(@PathVariable String id,
			@Valid @RequestBody DataRequest<ProductRequest> request) {
		productService.update(id, request.data());
		return ApiResponses.message("已更新產品");
	}

	@DeleteMapping("/product/{id}")
	public Map<String, Object> delete(@PathVariable String id) {
		productService.delete(id);
		return ApiResponses.message("已刪除產品");
	}
}
