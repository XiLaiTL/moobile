// 由 `moobile-host libgen` 生成 —— **不要手改**。
//
// 组件库：antd@6.6.4（命名空间 `antd:`）
// 生成器：moobile-host libgen 0.3.0｜manifest 版本 1
// 清单：改动请改 manifest 后重跑 `libgen`，或改这里的 `libgen.config.json`。
//
// 组件 71 个（含复合子组件共 136 个键）｜平台 [web]｜JSON 通道的组件 117 个

import * as antd from 'antd';
import React from 'react';

/** 在宿主启动时调用一次；返回实际注册的组件名（便于启动日志与验证脚本断言）。 */
export function registerAntd(registerLibrary) {
  return registerLibrary({
    namespace: 'antd',
    module: antd,
    // 显式清单：与 MoonBit 侧生成物同源（见本文件头部说明）
    components: [
      'Affix', 'Alert', 'Alert.ErrorBoundary', 'Anchor', 'Anchor.Link', 'App',
      'AutoComplete', 'AutoComplete.Option', 'Avatar', 'Avatar.Group', 'BackTop', 'Badge',
      'Badge.Ribbon', 'BorderBeam', 'Breadcrumb', 'Breadcrumb.Item', 'Breadcrumb.Separator', 'Button',
      'Calendar', 'Card', 'Card.Grid', 'Card.Meta', 'Carousel', 'Cascader',
      'Cascader.Panel', 'Cascader.SHOW_CHILD', 'Cascader.SHOW_PARENT', 'Checkbox', 'Checkbox.Group', 'Col',
      'Collapse', 'ColorPicker', 'ConfigProvider', 'ConfigProvider.ConfigContext', 'ConfigProvider.SizeContext', 'DatePicker',
      'Descriptions', 'Descriptions.Item', 'Divider', 'Drawer', 'Dropdown', 'Dropdown.Button',
      'Empty', 'Flex', 'FloatButton', 'Form', 'Form.ErrorList', 'Form.Item',
      'Form.List', 'Form.Provider', 'Image', 'Image.PreviewGroup', 'Input', 'Input.Group',
      'Input.OTP', 'Input.Password', 'Input.Search', 'Input.TextArea', 'InputNumber', 'Layout',
      'Layout.Content', 'Layout.Footer', 'Layout.Header', 'Layout.Sider', 'List', 'List.Item',
      'Listy', 'Masonry', 'Mentions', 'Mentions.Option', 'Menu', 'Menu.Divider',
      'Menu.Item', 'Menu.ItemGroup', 'Menu.SubMenu', 'Modal', 'Pagination', 'Popconfirm',
      'Popover', 'Progress', 'QRCode', 'Radio', 'Radio.Button', 'Radio.Group',
      'Rate', 'Result', 'Row', 'Segmented', 'Select', 'Select.OptGroup',
      'Select.Option', 'Skeleton', 'Slider', 'Space', 'Space.Addon', 'Space.Compact',
      'Spin', 'Splitter', 'Splitter.Panel', 'Statistic', 'Statistic.Countdown', 'Statistic.Timer',
      'Steps', 'Switch', 'Table', 'Tabs', 'Tabs.TabPane', 'Tag',
      'Tag.CheckableTag', 'Tag.CheckableTagGroup', 'TimePicker', 'TimePicker.RangePicker', 'Timeline', 'Tooltip',
      'Tooltip.UniqueProvider', 'Tour', 'Transfer', 'Transfer.List', 'Transfer.Operation', 'Transfer.Search',
      'Tree', 'Tree.DirectoryTree', 'Tree.TreeNode', 'TreeSelect', 'TreeSelect.SHOW_ALL', 'TreeSelect.SHOW_CHILD',
      'TreeSelect.SHOW_PARENT', 'TreeSelect.TreeNode', 'Typography', 'Typography.Link', 'Typography.Paragraph', 'Typography.Text',
      'Typography.Title', 'Upload', 'Upload.Dragger', 'Watermark',
    ],
    platforms: ['web'],
    // 结构化 prop（MoonBit 侧用 `prop_json` 传 JSON 文本，宿主这里 JSON.parse 后交给组件）
    jsonProps: {
      Affix: [
        'style',
      ],
      Alert: [
        'closable', 'style',
      ],
      Anchor: [
        'affix', 'items', 'style',
      ],
      App: [
        'message', 'notification', 'style',
      ],
      AutoComplete: [
        'OptionList', 'allowClear', 'builtinPlacements', 'components', 'dataSource',
        'defaultValue', 'displayValues', 'fieldNames', 'omitDomProps', 'options',
        'popupAlign', 'showAction', 'showSearch', 'style', 'tokenSeparators',
        'value',
      ],
      Avatar: [
        'size', 'style',
      ],
      'Avatar.Group': [
        'max', 'maxStyle', 'size', 'style',
      ],
      BackTop: [
        'style',
      ],
      Badge: [
        'offset', 'style',
      ],
      'Badge.Ribbon': [
        'style',
      ],
      BorderBeam: [
        'color', 'style',
      ],
      Breadcrumb: [
        'items', 'params', 'routes', 'style',
      ],
      'Breadcrumb.Item': [
        'dropdownProps', 'menu', 'style',
      ],
      Button: [
        'download', 'loading', 'style', 'value',
      ],
      Calendar: [
        'defaultValue', 'style', 'validRange', 'value',
      ],
      Card: [
        'actions', 'bodyStyle', 'headStyle', 'style', 'tabBarExtraContent',
        'tabList', 'tabProps',
      ],
      'Card.Grid': [
        'style',
      ],
      'Card.Meta': [
        'style',
      ],
      Carousel: [
        'autoplay', 'dots', 'responsive', 'style',
      ],
      Cascader: [
        'OptionList', 'allowClear', 'builtinPlacements', 'components', 'defaultValue',
        'displayValues', 'dropdownMenuColumnStyle', 'fieldNames', 'multiple', 'omitDomProps',
        'options', 'popupAlign', 'popupMenuColumnStyle', 'showAction', 'showSearch',
        'style', 'value',
      ],
      Checkbox: [
        'style', 'value',
      ],
      'Checkbox.Group': [
        'defaultValue', 'options', 'style', 'value',
      ],
      Col: [
        'style',
      ],
      Collapse: [
        'activeKey', 'defaultActiveKey', 'items', 'style',
      ],
      ColorPicker: [
        'arrow', 'autoAdjustOverflow', 'defaultValue', 'destroyTooltipOnHide', 'mode',
        'presets', 'style', 'value',
      ],
      ConfigProvider: [
        'affix', 'alert', 'anchor', 'app', 'avatar',
        'badge', 'borderBeam', 'breadcrumb', 'button', 'calendar',
        'card', 'cardMeta', 'carousel', 'cascader', 'checkbox',
        'collapse', 'colorPicker', 'csp', 'datePicker', 'descriptions',
        'divider', 'drawer', 'dropdown', 'empty', 'flex',
        'floatButton', 'floatButtonGroup', 'form', 'image', 'input',
        'inputNumber', 'inputPassword', 'inputSearch', 'layout', 'list',
        'listy', 'locale', 'masonry', 'mentions', 'menu',
        'message', 'modal', 'notification', 'otp', 'pagination',
        'popconfirm', 'popover', 'progress', 'qrcode', 'radio',
        'rangePicker', 'rate', 'result', 'ribbon', 'segmented',
        'select', 'skeleton', 'slider', 'space', 'spin',
        'splitter', 'statistic', 'steps', 'switch', 'table',
        'tabs', 'tag', 'textArea', 'theme', 'timePicker',
        'timeline', 'tooltip', 'tour', 'transfer', 'tree',
        'treeSelect', 'typography', 'upload', 'warning', 'watermark',
        'wave',
      ],
      'ConfigProvider.ConfigContext': [
        'affix', 'alert', 'anchor', 'app', 'avatar',
        'badge', 'borderBeam', 'breadcrumb', 'button', 'calendar',
        'card', 'cardMeta', 'carousel', 'cascader', 'checkbox',
        'collapse', 'colorPicker', 'datePicker', 'descriptions', 'divider',
        'drawer', 'dropdown', 'empty', 'flex', 'floatButton',
        'floatButtonGroup', 'form', 'image', 'input', 'inputNumber',
        'inputPassword', 'inputSearch', 'layout', 'list', 'listy',
        'masonry', 'mentions', 'menu', 'message', 'modal',
        'notification', 'otp', 'pagination', 'popconfirm', 'popover',
        'progress', 'qrcode', 'radio', 'rangePicker', 'rate',
        'result', 'ribbon', 'segmented', 'select', 'skeleton',
        'slider', 'space', 'spin', 'splitter', 'statistic',
        'steps', 'switch', 'table', 'tabs', 'tag',
        'textArea', 'timePicker', 'timeline', 'tooltip', 'tour',
        'transfer', 'tree', 'treeSelect', 'typography', 'upload',
        'watermark', 'wave',
      ],
      DatePicker: [
        'allowClear', 'builtinPlacements', 'components', 'format', 'locale',
        'multiple', 'popupAlign', 'presets', 'showTime', 'style',
      ],
      Descriptions: [
        'column', 'contentStyle', 'items', 'labelStyle', 'style',
      ],
      'Descriptions.Item': [
        'contentStyle', 'labelStyle', 'span', 'style',
      ],
      Divider: [
        'style',
      ],
      Drawer: [
        'bodyStyle', 'closable', 'contentWrapperStyle', 'drawerStyle', 'focusable',
        'footerStyle', 'headerStyle', 'mask', 'maskMotion', 'maskStyle',
        'motion', 'push', 'resizable', 'rootStyle', 'style',
      ],
      Dropdown: [
        'align', 'arrow', 'autoAdjustOverflow', 'menu', 'overlayStyle',
        'trigger',
      ],
      'Dropdown.Button': [
        'align', 'arrow', 'autoAdjustOverflow', 'loading', 'menu',
        'overlayStyle', 'style', 'trigger',
      ],
      Empty: [
        'imageStyle', 'style',
      ],
      Flex: [
        'style',
      ],
      FloatButton: [
        'badge', 'style', 'tooltip',
      ],
      Form: [
        'fields', 'form', 'initialValues', 'labelCol', 'scrollToFirstError',
        'style', 'tooltip', 'validateMessages', 'validateTrigger', 'wrapperCol',
      ],
      'Form.ErrorList': [
        'errors', 'warnings',
      ],
      'Form.Item': [
        'dependencies', 'hasFeedback', 'initialValue', 'labelCol', 'messageVariables',
        'rules', 'style', 'tooltip', 'validateTrigger', 'wrapperCol',
      ],
      'Form.List': [
        'initialValue', 'name', 'rules',
      ],
      Image: [
        'placeholder', 'preview', 'style', 'wrapperStyle',
      ],
      'Image.PreviewGroup': [
        'preview',
      ],
      Input: [
        'allowClear', 'count', 'showCount', 'style', 'value',
      ],
      'Input.Group': [
        'style',
      ],
      'Input.OTP': [
        'style',
      ],
      'Input.Password': [
        'allowClear', 'count', 'showCount', 'style', 'value',
        'visibilityToggle',
      ],
      'Input.Search': [
        'allowClear', 'count', 'showCount', 'style', 'value',
      ],
      'Input.TextArea': [
        'allowClear', 'autoSize', 'count', 'showCount', 'style',
        'value',
      ],
      InputNumber: [
        'controls', 'defaultValue', 'max', 'min', 'style',
        'value',
      ],
      Layout: [
        'style',
      ],
      'Layout.Content': [
        'style',
      ],
      'Layout.Footer': [
        'style',
      ],
      'Layout.Header': [
        'style',
      ],
      'Layout.Sider': [
        'style', 'zeroWidthTriggerStyle',
      ],
      List: [
        'dataSource', 'grid', 'loading', 'locale', 'pagination',
        'style',
      ],
      'List.Item': [
        'actions', 'colStyle', 'style',
      ],
      Listy: [
        'group', 'items', 'style',
      ],
      Masonry: [
        'columns', 'gutter', 'items', 'style',
      ],
      Mentions: [
        'allowClear', 'autoSize', 'count', 'options', 'prefix',
        'style',
      ],
      Menu: [
        'builtinPlacements', 'defaultMotions', 'defaultOpenKeys', 'defaultSelectedKeys', 'items',
        'motion', 'openKeys', 'selectedKeys', 'style', 'tooltip',
      ],
      'Menu.Divider': [
        'style',
      ],
      'Menu.Item': [
        'attribute', 'style',
      ],
      'Menu.ItemGroup': [
        'style',
      ],
      Modal: [
        'bodyProps', 'bodyStyle', 'cancelButtonProps', 'closable', 'focusable',
        'mask', 'maskProps', 'maskStyle', 'mousePosition', 'okButtonProps',
        'rootStyle', 'style', 'width', 'wrapProps',
      ],
      Pagination: [
        'components', 'locale', 'pageSizeOptions', 'selectComponentClass', 'showQuickJumper',
        'showSizeChanger', 'simple', 'style',
      ],
      Popconfirm: [
        'arrow', 'autoAdjustOverflow', 'cancelButtonProps', 'destroyTooltipOnHide', 'okButtonProps',
        'overlayInnerStyle', 'overlayStyle', 'style',
      ],
      Popover: [
        'arrow', 'autoAdjustOverflow', 'destroyTooltipOnHide', 'overlayInnerStyle', 'overlayStyle',
        'style',
      ],
      Progress: [
        'percentPosition', 'size', 'steps', 'strokeColor', 'style',
        'success',
      ],
      QRCode: [
        'iconSize', 'style', 'value',
      ],
      Radio: [
        'style', 'value',
      ],
      'Radio.Button': [
        'style', 'value',
      ],
      'Radio.Group': [
        'defaultValue', 'options', 'style', 'value',
      ],
      Rate: [
        'style', 'tooltips',
      ],
      Result: [
        'style',
      ],
      Row: [
        'align', 'gutter', 'justify', 'style',
      ],
      Segmented: [
        'defaultValue', 'options', 'style', 'value',
      ],
      Select: [
        'OptionList', 'allowClear', 'builtinPlacements', 'components', 'defaultValue',
        'displayValues', 'fieldNames', 'omitDomProps', 'optionFilterProp', 'options',
        'popupAlign', 'showAction', 'showSearch', 'style', 'tokenSeparators',
        'value',
      ],
      Skeleton: [
        'avatar', 'paragraph', 'style', 'title',
      ],
      Slider: [
        'activeDotStyle', 'ariaLabelForHandle', 'ariaLabelledByForHandle', 'ariaValueTextFormatterForHandle', 'defaultValue',
        'disabled', 'dotStyle', 'handleStyle', 'marks', 'railStyle',
        'range', 'style', 'tabIndex', 'trackStyle', 'value',
      ],
      Space: [
        'size', 'style',
      ],
      'Space.Addon': [
        'style',
      ],
      'Space.Compact': [
        'style',
      ],
      Spin: [
        'style',
      ],
      Splitter: [
        'collapsible', 'collapsibleIcon', 'style',
      ],
      'Splitter.Panel': [
        'collapsible', 'style',
      ],
      Statistic: [
        'style', 'valueStyle',
      ],
      'Statistic.Countdown': [
        'style', 'valueStyle',
      ],
      'Statistic.Timer': [
        'style', 'valueStyle',
      ],
      Steps: [
        'items', 'style',
      ],
      Switch: [
        'style',
      ],
      Table: [
        'column', 'columns', 'components', 'dataSource', 'defaultExpandedRowKeys',
        'expandable', 'expandedRowKeys', 'loading', 'locale', 'onHeaderRow',
        'onRow', 'pagination', 'rowSelection', 'scroll', 'showSorterTooltip',
        'sortDirections', 'sticky', 'style',
      ],
      Tabs: [
        'animated', 'indicator', 'items', 'locale', 'more',
        'style', 'tabBarExtraContent', 'tabBarStyle',
      ],
      'Tabs.TabPane': [
        'style',
      ],
      Tag: [
        'closable', 'style',
      ],
      'Tag.CheckableTag': [
        'style',
      ],
      'Tag.CheckableTagGroup': [
        'defaultValue', 'options', 'style', 'value',
      ],
      TimePicker: [
        'locale', 'multiple',
      ],
      'TimePicker.RangePicker': [
        'allowClear', 'allowEmpty', 'builtinPlacements', 'components', 'defaultOpenValue',
        'defaultPickerValue', 'defaultValue', 'disabled', 'format', 'id',
        'locale', 'maxDate', 'minDate', 'mode', 'pickerValue',
        'placeholder', 'popupAlign', 'presets', 'ranges', 'showTime',
        'style', 'value',
      ],
      Timeline: [
        'items', 'style',
      ],
      Tooltip: [
        'arrow', 'autoAdjustOverflow', 'destroyTooltipOnHide', 'overlayInnerStyle', 'overlayStyle',
        'style',
      ],
      Tour: [
        'animated', 'arrow', 'builtinPlacements', 'closable', 'gap',
        'mask', 'steps', 'style',
      ],
      Transfer: [
        'actions', 'dataSource', 'listStyle', 'locale', 'operationStyle',
        'operations', 'pagination', 'selectAllLabels', 'selectedKeys', 'showSearch',
        'style', 'targetKeys', 'titles',
      ],
      'Transfer.List': [
        'checkedKeys', 'dataSource', 'notFoundContent', 'pagination', 'showSearch',
        'style', 'titles',
      ],
      'Transfer.Operation': [
        'actions', 'style',
      ],
      Tree: [
        'checkedKeys', 'defaultCheckedKeys', 'defaultExpandedKeys', 'defaultSelectedKeys', 'draggable',
        'expandedKeys', 'fieldNames', 'loadedKeys', 'motion', 'rootStyle',
        'selectedKeys', 'showLine', 'style', 'treeData',
      ],
      'Tree.DirectoryTree': [
        'checkedKeys', 'defaultCheckedKeys', 'defaultExpandedKeys', 'defaultSelectedKeys', 'draggable',
        'expandedKeys', 'fieldNames', 'loadedKeys', 'motion', 'rootStyle',
        'selectedKeys', 'showLine', 'style', 'treeData',
      ],
      'Tree.TreeNode': [
        'data', 'isEnd', 'isStart', 'style',
      ],
      TreeSelect: [
        'OptionList', 'allowClear', 'builtinPlacements', 'components', 'defaultValue',
        'displayValues', 'fieldNames', 'omitDomProps', 'popupAlign', 'showAction',
        'showSearch', 'style', 'tokenSeparators', 'treeCheckable', 'treeData',
        'treeDataSimpleMode', 'treeDefaultExpandedKeys', 'treeExpandedKeys', 'treeLine', 'treeLoadedKeys',
        'value',
      ],
      Typography: [
        'style',
      ],
      'Typography.Link': [
        'actions', 'copyable', 'download', 'editable', 'style',
      ],
      'Typography.Paragraph': [
        'actions', 'copyable', 'editable', 'ellipsis', 'style',
      ],
      'Typography.Text': [
        'actions', 'copyable', 'editable', 'ellipsis', 'style',
      ],
      'Typography.Title': [
        'actions', 'copyable', 'editable', 'ellipsis', 'style',
      ],
      Upload: [
        'accept', 'data', 'defaultFileList', 'fileList', 'headers',
        'locale', 'progress', 'showUploadList', 'style',
      ],
      'Upload.Dragger': [
        'accept', 'data', 'defaultFileList', 'fileList', 'headers',
        'locale', 'progress', 'showUploadList', 'style',
      ],
      Watermark: [
        'content', 'font', 'gap', 'offset', 'style',
      ],
    },
    // 事件键 → 组件库的 prop 名。**这里刻意是身份映射**：生成的 MoonBit 侧写的是
    // `.on_raw("onClick", …)`（键就是 prop 名），于是不需要"猜落点"这一层 ——
    // 而 `MOBILE_HOST.events["<ns>:*"]` 是库级通配，任何组件共用同一张表。
    events: {
      onActive: 'onActive', onActiveChange: 'onActiveChange', onActiveValueChange: 'onActiveValueChange', onAfterChange: 'onAfterChange', onAnimationEnd: 'onAnimationEnd',
      onAnimationIteration: 'onAnimationIteration', onAnimationStart: 'onAnimationStart', onAuxClick: 'onAuxClick', onBeforeChange: 'onBeforeChange', onBeforeInput: 'onBeforeInput',
      onBlur: 'onBlur', onBreakpoint: 'onBreakpoint', onCalendarChange: 'onCalendarChange', onCancel: 'onCancel', onChange: 'onChange',
      onChangeComplete: 'onChangeComplete', onCheck: 'onCheck', onClear: 'onClear', onClick: 'onClick', onClose: 'onClose',
      onCollapse: 'onCollapse', onCompositionEnd: 'onCompositionEnd', onCompositionStart: 'onCompositionStart', onCompositionUpdate: 'onCompositionUpdate', onConfirm: 'onConfirm',
      onContextMenu: 'onContextMenu', onCopy: 'onCopy', onCut: 'onCut', onDeselect: 'onDeselect', onDisplayValuesChange: 'onDisplayValuesChange',
      onDoubleClick: 'onDoubleClick', onDownload: 'onDownload', onDragEnd: 'onDragEnd', onDragEnter: 'onDragEnter', onDragLeave: 'onDragLeave',
      onDragOver: 'onDragOver', onDragStart: 'onDragStart', onDraggerDoubleClick: 'onDraggerDoubleClick', onDrop: 'onDrop', onDropdownVisibleChange: 'onDropdownVisibleChange',
      onEdge: 'onEdge', onEdit: 'onEdit', onError: 'onError', onExpand: 'onExpand', onExpandedRowsChange: 'onExpandedRowsChange',
      onFieldsChange: 'onFieldsChange', onFinish: 'onFinish', onFinishFailed: 'onFinishFailed', onFocus: 'onFocus', onFormChange: 'onFormChange',
      onFormFinish: 'onFormFinish', onFormatChange: 'onFormatChange', onGotPointerCapture: 'onGotPointerCapture', onHoverChange: 'onHoverChange', onInit: 'onInit',
      onInput: 'onInput', onInputKeyDown: 'onInputKeyDown', onInvalid: 'onInvalid', onItemRemove: 'onItemRemove', onItemSelect: 'onItemSelect',
      onItemSelectAll: 'onItemSelectAll', onKeyDown: 'onKeyDown', onKeyPress: 'onKeyPress', onKeyUp: 'onKeyUp', onLayoutChange: 'onLayoutChange',
      onLazyLoad: 'onLazyLoad', onLoad: 'onLoad', onLostPointerCapture: 'onLostPointerCapture', onMetaChange: 'onMetaChange', onMouseDown: 'onMouseDown',
      onMouseEnter: 'onMouseEnter', onMouseLeave: 'onMouseLeave', onMouseMove: 'onMouseMove', onMouseOut: 'onMouseOut', onMouseOver: 'onMouseOver',
      onMouseUp: 'onMouseUp', onOk: 'onOk', onOpenChange: 'onOpenChange', onPanelChange: 'onPanelChange', onPaste: 'onPaste',
      onPickerValueChange: 'onPickerValueChange', onPointerCancel: 'onPointerCancel', onPointerDown: 'onPointerDown', onPointerEnter: 'onPointerEnter', onPointerLeave: 'onPointerLeave',
      onPointerMove: 'onPointerMove', onPointerOut: 'onPointerOut', onPointerOver: 'onPointerOver', onPointerUp: 'onPointerUp', onPopupAlign: 'onPopupAlign',
      onPopupClick: 'onPopupClick', onPopupScroll: 'onPopupScroll', onPopupVisibleChange: 'onPopupVisibleChange', onPressEnter: 'onPressEnter', onPreview: 'onPreview',
      onReInit: 'onReInit', onRefresh: 'onRefresh', onRemove: 'onRemove', onReset: 'onReset', onResize: 'onResize',
      onResizeEnd: 'onResizeEnd', onResizeStart: 'onResizeStart', onRightClick: 'onRightClick', onScroll: 'onScroll', onSearch: 'onSearch',
      onSearchSplit: 'onSearchSplit', onSelect: 'onSelect', onSelectChange: 'onSelectChange', onShowSizeChange: 'onShowSizeChange', onStep: 'onStep',
      onSubmit: 'onSubmit', onSwipe: 'onSwipe', onTabChange: 'onTabChange', onTabClick: 'onTabClick', onTabScroll: 'onTabScroll',
      onToggle: 'onToggle', onTouchCancel: 'onTouchCancel', onTouchEnd: 'onTouchEnd', onTouchMove: 'onTouchMove', onTouchStart: 'onTouchStart',
      onTransitionEnd: 'onTransitionEnd', onTreeExpand: 'onTreeExpand', onTreeLoad: 'onTreeLoad', onValuesChange: 'onValuesChange', onVisibleChanged: 'onVisibleChanged',
      onWheel: 'onWheel',
    },
    // Provider 包裹：组件库的组件要在它的 Provider 里面才算"装配完整"
    wrap: (el) => React.createElement(antd.ConfigProvider, null, el),
  });
}
