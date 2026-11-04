package com.percyku.backend.controller;

import java.util.Map;

import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.percyku.backend.dto.ApiResponses;
import com.percyku.backend.dto.DataRequest;
import com.percyku.backend.dto.OrderUpdateRequest;
import com.percyku.backend.service.OrderService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/${app.api-path}/admin")
public class AdminOrderController {

	private final OrderService orderService;

	public AdminOrderController(OrderService orderService) {
		this.orderService = orderService;
	}

	@GetMapping("/orders")
	public Map<String, Object> page(@RequestParam(required = false) String page) {
		return ApiResponses.pageWithMessages("orders", orderService.page(page));
	}

	@PutMapping("/order/{id}")
	public Map<String, Object> update(@PathVariable String id,
			@Valid @RequestBody DataRequest<OrderUpdateRequest> request) {
		orderService.update(id, request.data());
		return ApiResponses.message("已更新訂單資訊");
	}

	@DeleteMapping("/order/{id}")
	public Map<String, Object> delete(@PathVariable String id) {
		orderService.delete(id);
		return ApiResponses.message("已刪除");
	}

	@DeleteMapping("/orders/all")
	public Map<String, Object> deleteAll() {
		orderService.deleteAll();
		return ApiResponses.message("已刪除");
	}
}
